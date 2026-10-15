import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { prisma } from "@formbricks/database";
import {
  applyOnlineSchemaMigrations,
  openUpgradeSession,
  readOnlineUpgradeCheckpoint,
} from "@formbricks/database/upgrade-session";
import { openJobsUpgradeQueue } from "@formbricks/jobs";
import { closeAuthzedClient } from "@/lib/authzed/client";
import { applyCanonicalAuthzedSchema, checkCanonicalAuthzedSchema } from "@/lib/authzed/schema";
import { setProjectionScopeReady } from "@/lib/authzed/scope-readiness";
import { env } from "@/lib/env";
import { ONLINE_UPGRADE_RELEASE } from "../compatibility";
import {
  type OnlineState,
  OnlineUpgradeBlocked,
  runOnlineUpgrade,
  summarizeOnlineState,
  toOnlineBlocker,
} from "./coordinator";
import {
  type DataHistoryRow,
  type ReleaseHistory,
  type SchemaHistoryRow,
  verifyMigrationHistory,
} from "./history";
import { backfillOnlineSurveys, verifyOnlineProjection } from "./projection";
import { handoffJobs } from "./queue-handoff";

export type OnlinePlatform = {
  targetImage: string;
  sourceVersion: "6.0.0" | "6.0.1" | "6.0.2";
  sessionAffinity: boolean;
  preflight: (retirementStarted: boolean) => Promise<void>;
  retireSourceConsumers: (assertLock: () => Promise<void>) => Promise<void>;
  jobDrainTimeoutSeconds: number;
  verifySourceConsumersAbsent: () => Promise<void>;
  verifyConsumers: () => Promise<void>;
  handoff?: (assertLock: () => Promise<void>) => Promise<void>;
  releaseAccess?: (assertLock: () => Promise<void>) => Promise<void>;
  cleanup?: (assertLock: () => Promise<void>) => Promise<void>;
};
type BundledMigration = { name: string; sql?: string; checksum?: string };
const finalization = new Set([
  "20261002120001_backfill_survey_owner",
  "20261002120002_add_survey_projection_trigger",
]);
const execFileAsync = promisify(execFile);

/** Read-only status remains available after the successful hook's temporary credentials are removed. */
export const readOnlineStatus = async () => {
  try {
    const connection = env.MIGRATE_DATABASE_URL ?? env.DATABASE_URL;
    const schema = new URL(connection).searchParams.get("schema");
    if (schema && schema !== "public") throw new OnlineUpgradeBlocked("nonpublic_schema_unsupported");
    return summarizeOnlineState(
      await readOnlineUpgradeCheckpoint<OnlineState>(connection, ONLINE_UPGRADE_RELEASE)
    );
  } catch (error) {
    const result = summarizeOnlineState(null, toOnlineBlocker(error, "online_upgrade_failed", true));
    result.rollbackTo60Allowed = false;
    return result;
  }
};

export const runOnlineCommand = async (
  command: "prepare" | "finalize" | "status",
  platform: OnlinePlatform,
  assetRoot: URL
) => {
  if (command === "status") return readOnlineStatus();
  let session: Awaited<ReturnType<typeof openUpgradeSession>> | undefined;
  let state: OnlineState | null = null;
  let stateKnown = false;
  let readLatest: (() => Promise<OnlineState | null>) | undefined;
  try {
    if (!env.MIGRATE_DATABASE_URL || !platform.sessionAffinity || env.FORMBRICKS_UPGRADE_MODE !== "online")
      throw new OnlineUpgradeBlocked("session_affine_migration_connection_required");
    if (
      new URL(env.MIGRATE_DATABASE_URL).searchParams.get("schema") &&
      new URL(env.MIGRATE_DATABASE_URL).searchParams.get("schema") !== "public"
    )
      throw new OnlineUpgradeBlocked("nonpublic_schema_unsupported");
    session = await openUpgradeSession(env.MIGRATE_DATABASE_URL);
    const lock = session;
    const read = async (): Promise<OnlineState | null> => {
      const table = await lock.client.query<{ exists: boolean }>(
        `SELECT to_regclass('"OnlineUpgradeState"') IS NOT NULL AS exists`
      );
      if (!table.rows[0].exists) return null;
      return (
        (
          await lock.client.query<OnlineState>('SELECT * FROM "OnlineUpgradeState" WHERE release = $1', [
            ONLINE_UPGRADE_RELEASE,
          ])
        ).rows[0] ?? null
      );
    };
    readLatest = read;
    state = await read();
    stateKnown = true;
    const migrations: BundledMigration[] = JSON.parse(
      await readFile(new URL("target-migrations.json", assetRoot), "utf8")
    );
    const sources: Record<string, ReleaseHistory> = JSON.parse(
      await readFile(new URL("source-migrations.json", assetRoot), "utf8")
    );
    const source = sources[platform.sourceVersion];
    if (!source) throw new OnlineUpgradeBlocked("unsupported_source_release");
    const target: ReleaseHistory = {
      schema: Object.fromEntries(migrations.filter((m) => m.checksum).map((m) => [m.name, m.checksum!])),
      data: migrations.filter((m) => !m.sql).map((m) => m.name),
    };
    const save = async (patch: Partial<OnlineState>) => {
      await lock.assertLock();
      await prisma.onlineUpgradeState.update({ where: { release: ONLINE_UPGRADE_RELEASE }, data: patch });
    };
    const verifyHistory = async () => {
      const schema = await lock.client.query<SchemaHistoryRow>(
        "SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations"
      );
      const data = await lock.client.query<DataHistoryRow>('SELECT name AS id, status FROM "DataMigration"');
      verifyMigrationHistory(source, target, schema.rows, data.rows, !!(await read()));
    };
    const migrate = async (phase: "prepare" | "finalize") => {
      await lock.assertLock();
      if (phase === "finalize") {
        // The survey trigger must not exist while legacy ownership is caught up. Each committed
        // page is its own resume point; new 6.1 surveys are excluded by creation provenance.
        for (;;) {
          await lock.assertLock();
          const changed = await lock.client
            .query(`UPDATE "Survey" SET "ownerId" = "createdBy", "ownershipInitialized" = true
            WHERE id IN (SELECT id FROM "Survey" WHERE "ownerId" IS NULL AND "createdBy" IS NOT NULL
              AND NOT "ownershipInitialized" ORDER BY id LIMIT 500)`);
          if (!changed.rowCount) break;
        }
        await lock.client.query(`INSERT INTO "DataMigration" (id, name, status, finished_at)
          VALUES ('pqgmcbm8az1vb2c3zz5ojrmp', '20261002120001_backfill_survey_owner', 'applied', now())
          ON CONFLICT (id) DO UPDATE SET status = 'applied', finished_at = now()`);
      }
      const sql = migrations
        .filter(
          (m): m is Required<BundledMigration> =>
            !!m.sql && !!m.checksum && (phase === "finalize" || !finalization.has(m.name))
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      await applyOnlineSchemaMigrations(lock, sql);
      await lock.assertLock();
      // The CLI bundle inlines @formbricks/database, so the package cannot be resolved at runtime. The image
      // keeps the bundle (assetRoot) beside packages/database/dist, which holds the migration script.
      const applyMigrations = fileURLToPath(
        new URL("../packages/database/dist/scripts/apply-migrations.js", assetRoot)
      );
      await execFileAsync(process.execPath, [applyMigrations, "--phase", phase], {
        signal: lock.signal,
        timeout: 30 * 60_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      await lock.assertLock();
      await verifyHistory();
    };
    const result = await runOnlineUpgrade(command, {
      targetImage: platform.targetImage,
      read,
      save,
      assertLock: lock.assertLock,
      preflight: async () => {
        const checkpoint = await read();
        await platform.preflight(!!checkpoint?.queuePausedAt);
        await verifyHistory();
        const canonical = await checkCanonicalAuthzedSchema();
        if (canonical.status === "matched" && (await read())) return;
        const legacy = await checkCanonicalAuthzedSchema({
          readCanonicalSchema: () => readFile(new URL("schema-6.0.zed", assetRoot), "utf8"),
        });
        if (legacy.status !== "matched") throw new OnlineUpgradeBlocked("unknown_source_schema");
      },
      prepare: async () => {
        await lock.assertLock();
        const stateMigration = migrations.find((m) => m.name === "20261013120000_add_online_upgrade_state");
        if (!stateMigration?.sql) throw new OnlineUpgradeBlocked("missing_release_assets");
        await lock.client.query(stateMigration.sql);
        // This intent precedes every other release mutation. It is distinct from verified preparation.
        await lock.client.query(
          'INSERT INTO "OnlineUpgradeState" (release, "targetImage", phase) VALUES ($1, $2, $3) ON CONFLICT (release) DO NOTHING',
          [ONLINE_UPGRADE_RELEASE, platform.targetImage, "preparing"]
        );
        await migrate("prepare");
        const old = await checkCanonicalAuthzedSchema({
          readCanonicalSchema: () => readFile(new URL("schema-6.0.zed", assetRoot), "utf8"),
        });
        const current = await checkCanonicalAuthzedSchema();
        if (current.status !== "matched") {
          if (old.status !== "matched") throw new OnlineUpgradeBlocked("unknown_source_schema");
          await lock.assertLock();
          await applyCanonicalAuthzedSchema(old.remoteDigest);
        }
      },
      verifyPrepared: async () => {
        await verifyHistory();
        if ((await checkCanonicalAuthzedSchema()).status !== "matched")
          throw new OnlineUpgradeBlocked("schema_not_prepared");
      },
      verifyConsumers: platform.verifyConsumers,
      finalizeMigrations: () => migrate("finalize"),
      backfill: () => backfillOnlineSurveys(lock.assertLock),
      verifyProjection: () => verifyOnlineProjection(lock.assertLock),
      activate: () => setProjectionScopeReady("survey", "online-upgrade-6.1"),
      cleanup: platform.cleanup ? () => platform.cleanup!(lock.assertLock) : undefined,
    });
    if (command === "prepare" && platform.handoff && !(await read())?.activatedAt) {
      const checkpoint = await read();
      if (!checkpoint?.queuePausedAt || checkpoint.queueResumedAt) {
        await save({ phase: "handoff" });
        await platform.handoff(lock.assertLock);
      }
      if (!env.REDIS_URL) throw new OnlineUpgradeBlocked("queue_connection_required");
      const queue = await openJobsUpgradeQueue(env.REDIS_URL);
      try {
        await handoffJobs({
          read: async () => {
            const value = await read();
            if (!value) throw new OnlineUpgradeBlocked("preparation_required");
            return value;
          },
          save,
          assertLock: lock.assertLock,
          queue,
          retireSourceConsumers: (assertDrained) => platform.retireSourceConsumers(assertDrained),
          verifySourceConsumersAbsent: platform.verifySourceConsumersAbsent,
          timeoutSeconds: platform.jobDrainTimeoutSeconds,
        });
      } finally {
        await queue.close();
      }
      return summarizeOnlineState(await read());
    }
    if (command === "finalize" && result.phase === "complete")
      await platform.releaseAccess?.(lock.assertLock);
    return result;
  } catch (error) {
    if (readLatest) {
      stateKnown = false;
      try {
        state = await readLatest();
        stateKnown = true;
      } catch {
        /* Never infer rollback safety from an unavailable checkpoint. */
      }
    }
    const result = summarizeOnlineState(state, toOnlineBlocker(error, "online_upgrade_failed", true));
    // On connection loss, never advertise rollback based on a stale pre-finalization read.
    if (!stateKnown || !session || session.signal.aborted) result.rollbackTo60Allowed = false;
    return result;
  } finally {
    closeAuthzedClient();
    await session?.close().catch(() => {});
  }
};
