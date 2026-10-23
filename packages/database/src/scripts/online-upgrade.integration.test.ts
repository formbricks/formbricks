import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterAll, beforeAll, expect, test } from "vitest";
import { getPgConnectionConfig } from "../pg-connection-config";
import { ensureOnlineIndexes } from "./online-indexes";
import {
  applyOnlineSchemaMigrations,
  openUpgradeSession,
  readOnlineUpgradeCheckpoint,
} from "./upgrade-session";

// Opt in only against a disposable database: this fixture creates its own schema and drops it afterward.
const connection = process.env.ONLINE_UPGRADE_TEST_DATABASE_URL;
const schema = `online_upgrade_${Date.now()}`;
let client: Client;
let url: string;
beforeAll(async () => {
  if (!connection) return;
  const parsed = new URL(connection);
  parsed.searchParams.set("options", `-c search_path=${schema}`);
  url = parsed.toString();
  client = new Client(getPgConnectionConfig(url));
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`CREATE TABLE "Response" (id text, created_at timestamp, "surveyId" text, "contactId" text);
    CREATE TABLE "User" ("isBootstrapAdmin" boolean);
    CREATE TABLE "Survey" ("workspaceId" text, "ownerId" text, "visibilityPending" boolean);
    CREATE TABLE _prisma_migrations (id text, checksum text, migration_name text, started_at timestamp, finished_at timestamp, rolled_back_at timestamp, applied_steps_count integer)`);
});
afterAll(async () => {
  if (!connection) return;
  await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  await client.end();
});

test.skipIf(!connection)(
  "repairs an interrupted invalid index and preserves valid indexes on repeat",
  async () => {
    await client.query('INSERT INTO "User" VALUES (true), (true)');
    await expect(
      client.query(
        'CREATE UNIQUE INDEX CONCURRENTLY "User_isBootstrapAdmin_key" ON "User" ("isBootstrapAdmin")'
      )
    ).rejects.toThrow();
    expect(
      (
        await client.query<{ indisvalid: boolean }>(
          "SELECT indisvalid FROM pg_index WHERE indexrelid = '\"User_isBootstrapAdmin_key\"'::regclass"
        )
      ).rows[0].indisvalid
    ).toBe(false);
    await client.query('DELETE FROM "User"');
    await ensureOnlineIndexes(url);
    const before = await client.query<{ indexrelid: number; indisvalid: boolean }>(
      "SELECT indexrelid, indisvalid FROM pg_index WHERE indrelid = '\"User\"'::regclass"
    );
    expect(before.rows[0].indisvalid).toBe(true);
    await ensureOnlineIndexes(url);
    expect(
      (
        await client.query<{ indexrelid: number; indisvalid: boolean }>(
          "SELECT indexrelid, indisvalid FROM pg_index WHERE indrelid = '\"User\"'::regclass"
        )
      ).rows
    ).toEqual(before.rows);
  }
);

test.skipIf(!connection)("serializes coordinators and detects a terminated lock session", async () => {
  const session = await openUpgradeSession(url);
  await expect(openUpgradeSession(url)).rejects.toThrow("upgrade_already_running");
  await session.assertLock();
  await client.query('CREATE TABLE "OnlineUpgradeState" (release text, phase text)');
  await client.query(`INSERT INTO "OnlineUpgradeState" VALUES ('6.1', 'finalizing')`);
  expect(await readOnlineUpgradeCheckpoint(url, "6.1")).toEqual({ release: "6.1", phase: "finalizing" });
  const { rows } = await session.client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
  await client.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
  await expect(session.assertLock()).rejects.toThrow();
  await session.close().catch(() => {});
});

test.skipIf(!connection)("rolls back SQL and its history together, then resumes idempotently", async () => {
  const session = await openUpgradeSession(url);
  try {
    await expect(
      applyOnlineSchemaMigrations(session, [
        {
          name: "addition",
          checksum: "bad",
          sql: "CREATE TABLE addition(id int); SELECT missing_function()",
        },
      ])
    ).rejects.toThrow();
    expect(
      (await client.query<{ name: string | null }>("SELECT to_regclass('addition') AS name")).rows[0].name
    ).toBeNull();
    expect(
      (await client.query<{ count: number }>("SELECT count(*)::int AS count FROM _prisma_migrations")).rows[0]
        .count
    ).toBe(0);
    const migration = { name: "addition", checksum: "good", sql: "CREATE TABLE addition(id int)" };
    await applyOnlineSchemaMigrations(session, [migration]);
    await applyOnlineSchemaMigrations(session, [migration]);
    expect(
      (await client.query<{ count: number }>("SELECT count(*)::int AS count FROM _prisma_migrations")).rows[0]
        .count
    ).toBe(1);
  } finally {
    await session.close();
  }
});

test.skipIf(!connection)(
  "persists queue pause recovery timestamps through the actual release migration",
  async () => {
    const session = await openUpgradeSession(url);
    try {
      const name = "20261013130000_add_online_upgrade_queue_pause";
      const sql = await readFile(new URL(`../../migration/${name}/migration.sql`, import.meta.url), "utf8");
      const migration = { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
      await applyOnlineSchemaMigrations(session, [migration]);
      const paused = new Date("2026-10-13T12:00:00Z");
      const deadline = new Date(paused.getTime() + 180_000);
      await client.query(
        'UPDATE "OnlineUpgradeState" SET "queuePausedAt" = $1, "queuePauseDeadlineAt" = $2 WHERE release = $3',
        [paused, deadline, "6.1"]
      );
      // A restarted coordinator reuses migration history and reads the same pending intent.
      await applyOnlineSchemaMigrations(session, [migration]);
      expect(await readOnlineUpgradeCheckpoint(url, "6.1")).toMatchObject({
        queuePausedAt: paused,
        queuePauseDeadlineAt: deadline,
        queueResumedAt: null,
      });
      const resumed = new Date(deadline.getTime() + 30_000);
      await client.query('UPDATE "OnlineUpgradeState" SET "queueResumedAt" = $1 WHERE release = $2', [
        resumed,
        "6.1",
      ]);
      expect(await readOnlineUpgradeCheckpoint(url, "6.1")).toMatchObject({ queueResumedAt: resumed });
    } finally {
      await session.close();
    }
  }
);
