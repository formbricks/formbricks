import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeEach, expect, test, vi } from "vitest";
import { applyOnlineSchemaMigrations, openUpgradeSession } from "@formbricks/database/upgrade-session";
import { openJobsUpgradeQueue } from "@formbricks/jobs";
import { closeAuthzedClient } from "@/lib/authzed/client";
import { applyCanonicalAuthzedSchema, checkCanonicalAuthzedSchema } from "@/lib/authzed/schema";
import { setProjectionScopeReady } from "@/lib/authzed/scope-readiness";
import type { OnlineState } from "./coordinator";
import type { SchemaHistoryRow } from "./history";
import { backfillOnlineSurveys, verifyOnlineProjection } from "./projection";
import { type OnlinePlatform, runOnlineCommand } from "./runtime";

const { childProcess, updateState } = vi.hoisted(() => ({
  updateState: vi.fn<(args: { data: Partial<OnlineState> }) => Promise<unknown>>(),
  childProcess: vi.fn(
    (
      _command: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => callback(null, "", "")
  ),
}));
vi.mock("node:child_process", () => ({ execFile: childProcess }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("@formbricks/jobs", () => ({ openJobsUpgradeQueue: vi.fn() }));
vi.mock("@formbricks/database", () => ({ prisma: { onlineUpgradeState: { update: updateState } } }));
vi.mock("@formbricks/database/upgrade-session", () => ({
  openUpgradeSession: vi.fn(),
  readOnlineUpgradeCheckpoint: vi.fn(),
  applyOnlineSchemaMigrations: vi.fn(),
}));
vi.mock("@/lib/authzed/client", () => ({ closeAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/schema", () => ({
  applyCanonicalAuthzedSchema: vi.fn(),
  checkCanonicalAuthzedSchema: vi.fn(),
}));
vi.mock("@/lib/authzed/scope-readiness", () => ({ setProjectionScopeReady: vi.fn() }));
vi.mock("./projection", () => ({ backfillOnlineSurveys: vi.fn(), verifyOnlineProjection: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: {
    MIGRATE_DATABASE_URL: "postgresql://fixture@localhost/test",
    FORMBRICKS_UPGRADE_MODE: "online",
    REDIS_URL: "redis://fixture",
  },
}));

const target = "app@sha256:target";
// The CLI bundle's directory in the published image, which the CLI passes as the asset root.
const root = new URL("file:///home/nextjs/authzed-cli/");
const ownerMigration = "20261002120001_backfill_survey_owner";
const triggerMigration = "20261002120002_add_survey_projection_trigger";
const stateMigration = "20261013120000_add_online_upgrade_state";
const migrations = [
  { name: "released", checksum: "released-checksum", sql: "released DDL" },
  { name: stateMigration, checksum: "state-checksum", sql: "create state table" },
  { name: triggerMigration, checksum: "trigger-checksum", sql: "install survey trigger" },
  { name: ownerMigration },
];
const checkpoint = (): OnlineState => ({
  targetImage: target,
  phase: "preparing",
  completedPhases: [],
  surveyCursor: null,
  surveyCount: 0n,
  baselineCompletedAt: null,
  forwardOnlyAt: null,
  activatedAt: null,
  queuePausedAt: null,
  queuePauseDeadlineAt: null,
  queueResumedAt: null,
});
let state: OnlineState | null;
let history: SchemaHistoryRow[];
let dataHistory: { id: string; status: string }[];
let canonical: boolean;
let controller: AbortController;
let ownerPages: number;
let events: string[];
let session: Awaited<ReturnType<typeof openUpgradeSession>>;
let platform: OnlinePlatform;
const databaseQuery =
  vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>>();

beforeEach(() => {
  vi.clearAllMocks();
  state = null;
  canonical = false;
  history = [
    {
      migration_name: "released",
      checksum: "released-checksum",
      finished_at: new Date(),
      rolled_back_at: null,
    },
  ];
  dataHistory = [];
  ownerPages = 0;
  events = [];
  controller = new AbortController();
  databaseQuery.mockImplementation((sql) => {
    if (sql.includes("to_regclass")) return Promise.resolve({ rows: [{ exists: !!state }] });
    if (sql.startsWith('SELECT * FROM "OnlineUpgradeState"'))
      return Promise.resolve({ rows: state ? [state] : [] });
    if (sql.startsWith('INSERT INTO "OnlineUpgradeState"')) state ??= checkpoint();
    if (sql.startsWith("SELECT migration_name")) return Promise.resolve({ rows: history });
    if (sql.startsWith("SELECT name AS id")) return Promise.resolve({ rows: dataHistory });
    if (sql.startsWith('UPDATE "Survey"')) {
      events.push("owner-page");
      ownerPages++;
      return Promise.resolve({ rows: [], rowCount: ownerPages === 1 ? 500 : 0 });
    }
    if (sql.startsWith('INSERT INTO "DataMigration"'))
      dataHistory = [{ id: ownerMigration, status: "applied" }];
    return Promise.resolve({ rows: [] });
  });
  session = {
    client: { query: databaseQuery } as unknown as Awaited<ReturnType<typeof openUpgradeSession>>["client"],
    assertLock: vi
      .fn()
      .mockImplementation(() =>
        controller.signal.aborted ? Promise.reject(new Error("lock lost")) : Promise.resolve()
      ),
    signal: controller.signal,
    close: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(openUpgradeSession).mockResolvedValue(session);
  vi.mocked(readFile).mockImplementation((file) => {
    const name = new URL(String(file)).pathname.split("/").pop();
    if (name === "target-migrations.json") return Promise.resolve(JSON.stringify(migrations));
    if (name === "source-migrations.json")
      return Promise.resolve(
        JSON.stringify({ "6.0.2": { schema: { released: "released-checksum" }, data: [] } })
      );
    return Promise.resolve("legacy schema");
  });
  updateState.mockImplementation(({ data }) => {
    if (!state) throw new Error("checkpoint missing");
    Object.assign(state, data);
    return Promise.resolve({ ...state, release: "6.1", updatedAt: new Date() });
  });
  vi.mocked(applyOnlineSchemaMigrations).mockImplementation((_session, batch) => {
    for (const migration of batch) {
      if (!history.some((row) => row.migration_name === migration.name)) {
        events.push(`ddl:${migration.name}`);
        history.push({
          migration_name: migration.name,
          checksum: migration.checksum,
          finished_at: new Date(),
          rolled_back_at: null,
        });
      }
    }
    return Promise.resolve();
  });
  vi.mocked(checkCanonicalAuthzedSchema).mockImplementation((options) =>
    Promise.resolve({
      status: options?.readCanonicalSchema || canonical ? "matched" : "drifted",
      differenceCount: 0,
      differenceKinds: {},
      remoteDigest: "sha256:legacy",
      sourceDigest: "sha256:fixture",
      remoteState: "present",
    })
  );
  vi.mocked(applyCanonicalAuthzedSchema).mockImplementation(() => {
    canonical = true;
    return Promise.resolve({
      status: "applied",
      differenceCount: 0,
      remoteDigest: "sha256:target",
      sourceDigest: "sha256:target",
      remoteState: "present",
    });
  });
  vi.mocked(backfillOnlineSurveys).mockImplementation(() => {
    events.push("backfill");
    Object.assign(state!, { surveyCount: 501n, baselineCompletedAt: new Date() });
    return Promise.resolve();
  });
  vi.mocked(verifyOnlineProjection).mockImplementation(() => {
    events.push("projection-verified");
    return Promise.resolve();
  });
  vi.mocked(setProjectionScopeReady).mockImplementation(() => {
    events.push("activated");
    return Promise.resolve();
  });
  platform = {
    targetImage: target,
    sourceVersion: "6.0.2",
    sessionAffinity: true,
    jobDrainTimeoutSeconds: 180,
    preflight: vi.fn().mockResolvedValue(undefined),
    retireSourceConsumers: vi.fn().mockResolvedValue(undefined),
    verifySourceConsumersAbsent: vi.fn().mockResolvedValue(undefined),
    verifyConsumers: vi.fn().mockImplementation(() => {
      events.push("consumers-verified");
      return Promise.resolve();
    }),
    releaseAccess: vi.fn(async (assertLock) => {
      await assertLock();
      expect(state?.phase).toBe("complete");
      events.push("access-released");
    }),
    cleanup: vi.fn().mockImplementation(() => {
      events.push("cleanup");
      return Promise.resolve();
    }),
  };
});

test("preparation expands only approved schemas and resumes without replaying migrations", async () => {
  const result = await runOnlineCommand("prepare", platform, root);
  expect(result).toMatchObject({ status: "prepared", rollbackTo60Allowed: true });
  expect(history.map((row) => row.migration_name)).not.toContain(triggerMigration);
  expect(ownerPages).toBe(0);
  expect(applyCanonicalAuthzedSchema).toHaveBeenCalledWith("sha256:legacy");
  expect(childProcess).toHaveBeenCalledWith(
    expect.any(String),
    ["/home/nextjs/packages/database/dist/scripts/apply-migrations.js", "--phase", "prepare"],
    expect.objectContaining({ signal: controller.signal }),
    expect.any(Function)
  );
  expect(setProjectionScopeReady).not.toHaveBeenCalled();
  expect(session.close).toHaveBeenCalledOnce();
  vi.mocked(applyOnlineSchemaMigrations).mockClear();
  expect(await runOnlineCommand("prepare", platform, root)).toMatchObject({ status: "prepared" });
  expect(applyOnlineSchemaMigrations).not.toHaveBeenCalled();
});

// The bundle inlines @formbricks/database, so the path above holds only while the image keeps the bundle and the
// database build under one WORKDIR.
test("the image keeps the CLI bundle beside the database build", () => {
  const dockerfile = readFileSync(new URL("../../../Dockerfile", import.meta.url), "utf8");
  const runner = dockerfile.slice(dockerfile.indexOf("AS runner"));
  // Source and destination only: options such as --chown or --chmod may change freely.
  const copies = (source: string, destination: string) =>
    new RegExp(String.raw`^COPY(?:\s+--\S+)*\s+${source}/?\s+${destination}/?\s*$`, "m");
  expect(runner.match(/^WORKDIR .+$/gm)).toEqual([
    `WORKDIR ${fileURLToPath(new URL("..", root)).slice(0, -1)}`,
  ]);
  expect(runner).toMatch(copies(String.raw`/app/apps/web/dist/authzed-cli`, String.raw`\./authzed-cli`));
  expect(runner).toMatch(
    copies(String.raw`/app/packages/database/dist`, String.raw`\./packages/database/dist`)
  );
});

test("a failed migration step reports the error's class and code, never its message", async () => {
  childProcess.mockImplementationOnce((_command, _args, _options, callback) =>
    callback(Object.assign(new Error("Command failed: credential=must-not-appear"), { code: 1 }), "", "")
  );
  const result = await runOnlineCommand("prepare", platform, root);
  expect(result).toMatchObject({
    status: "blocked",
    blockerCode: "online_upgrade_failed",
    retryable: true,
    cause: { name: "Error", code: "1" },
  });
  expect(JSON.stringify(result)).not.toContain("must-not-appear");
});

test("finalization catches up owners before triggers and activates only after projection verification", async () => {
  await runOnlineCommand("prepare", platform, root);
  const result = await runOnlineCommand("finalize", platform, root);
  expect(result).toMatchObject({
    status: "complete",
    rollbackTo60Allowed: false,
    progress: { surveys: "501", baselineComplete: true },
  });
  expect(ownerPages).toBe(2);
  expect(events.indexOf("owner-page")).toBeLessThan(events.indexOf(`ddl:${triggerMigration}`));
  expect(events.indexOf("consumers-verified")).toBeLessThan(events.indexOf("owner-page"));
  expect(events.indexOf("projection-verified")).toBeLessThan(events.indexOf("activated"));
  expect(events.indexOf("activated")).toBeLessThan(events.indexOf("cleanup"));
  expect(events.indexOf("cleanup")).toBeLessThan(events.indexOf("access-released"));
  expect(setProjectionScopeReady).toHaveBeenCalledWith("survey", "online-upgrade-6.1");
  expect(state?.completedPhases).toEqual(["prepare", "finalize", "activate"]);
});

test("projection failure preserves the forward-only boundary and a retry completes", async () => {
  await runOnlineCommand("prepare", platform, root);
  vi.mocked(verifyOnlineProjection).mockRejectedValueOnce(new Error("private database failure"));
  const failed = await runOnlineCommand("finalize", platform, root);
  expect(failed).toMatchObject({ status: "blocked", retryable: true, rollbackTo60Allowed: false });
  expect(JSON.stringify(failed)).not.toContain("private database failure");
  expect(setProjectionScopeReady).not.toHaveBeenCalled();
  expect(platform.cleanup).not.toHaveBeenCalled();
  expect(platform.releaseAccess).not.toHaveBeenCalled();
  expect(await runOnlineCommand("finalize", platform, root)).toMatchObject({ status: "complete" });
});

test("losing the lock during a page prevents activation and denies stale rollback advice", async () => {
  await runOnlineCommand("prepare", platform, root);
  vi.mocked(backfillOnlineSurveys).mockImplementationOnce(() => {
    controller.abort();
    return Promise.resolve();
  });
  expect(await runOnlineCommand("finalize", platform, root)).toMatchObject({
    status: "blocked",
    rollbackTo60Allowed: false,
  });
  expect(setProjectionScopeReady).not.toHaveBeenCalled();
  expect(closeAuthzedClient).toHaveBeenCalledTimes(2);
});

test("unknown source schema blocks preparation before database or graph writes", async () => {
  vi.mocked(checkCanonicalAuthzedSchema).mockResolvedValue({
    status: "drifted",
    differenceCount: 1,
    differenceKinds: { definition: 1 },
    remoteDigest: "sha256:unknown",
    sourceDigest: "sha256:fixture",
    remoteState: "present",
  });
  expect(await runOnlineCommand("prepare", platform, root)).toMatchObject({
    status: "blocked",
    blockerCode: "unknown_source_schema",
  });
  expect(applyOnlineSchemaMigrations).not.toHaveBeenCalled();
  expect(applyCanonicalAuthzedSchema).not.toHaveBeenCalled();
  expect(state).toBeNull();
});

test("a schema changed after preparation intent is recorded is never overwritten", async () => {
  vi.mocked(applyOnlineSchemaMigrations).mockImplementationOnce(() => {
    vi.mocked(checkCanonicalAuthzedSchema).mockResolvedValue({
      status: "drifted",
      differenceCount: 1,
      differenceKinds: { definition: 1 },
      remoteDigest: "sha256:unknown",
      sourceDigest: "sha256:fixture",
      remoteState: "present",
    });
    return Promise.resolve();
  });
  expect(await runOnlineCommand("prepare", platform, root)).toMatchObject({
    status: "blocked",
    blockerCode: "unknown_source_schema",
  });
  expect(state?.completedPhases).toEqual([]);
  expect(applyCanonicalAuthzedSchema).not.toHaveBeenCalled();
});

test("prepared handoff pauses jobs, verifies retirement, resumes and closes the queue", async () => {
  let paused = false;
  const queue = {
    isPaused: vi.fn(() => Promise.resolve(paused)),
    active: vi.fn().mockResolvedValue(0),
    pause: vi.fn(() => {
      paused = true;
      return Promise.resolve();
    }),
    resume: vi.fn(() => {
      paused = false;
      return Promise.resolve();
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(openJobsUpgradeQueue).mockResolvedValue(queue);
  platform.handoff = vi.fn().mockResolvedValue(undefined);
  platform.retireSourceConsumers = vi.fn(async (assertDrained) => {
    expect(paused).toBe(true);
    await assertDrained();
  });
  expect(await runOnlineCommand("prepare", platform, root)).toMatchObject({
    status: "prepared",
    phase: "rollout",
    jobs: { paused: false },
  });
  expect(platform.handoff).toHaveBeenCalledOnce();
  expect(platform.verifySourceConsumersAbsent).toHaveBeenCalledOnce();
  expect(queue.close).toHaveBeenCalledOnce();
  expect(state?.completedPhases).toContain("consumers-retired");
});

test("handoff failures close the queue and keep its durable pause for recovery", async () => {
  let paused = false;
  const queue = {
    isPaused: vi.fn(() => Promise.resolve(paused)),
    active: vi.fn().mockResolvedValue(0),
    pause: vi.fn(() => {
      paused = true;
      return Promise.resolve();
    }),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(openJobsUpgradeQueue).mockResolvedValue(queue);
  platform.handoff = vi.fn().mockResolvedValue(undefined);
  vi.mocked(platform.retireSourceConsumers).mockRejectedValue(new Error("retirement interrupted"));
  expect(await runOnlineCommand("prepare", platform, root)).toMatchObject({
    status: "blocked",
    phase: "retiring_consumers",
    jobs: { paused: true },
  });
  expect(queue.resume).not.toHaveBeenCalled();
  expect(queue.close).toHaveBeenCalledOnce();
});
