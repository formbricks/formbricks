import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { createContactDirectories } from "../20261123120001_create_contact_directories/migration";
import { getPgConnectionConfig } from "../../src/pg-connection-config";
import type { PrismaClient } from "../../src/prisma";
import { ensureOnlineIndexes } from "../../src/scripts/online-indexes";
import { backfillContactDirectories } from "./migration";

vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

/**
 * ENG-7491: the whole contact-directory migration (schema step, directories with their keys and
 * segments, the contact backfill, the online indexes and the foreign-key validation) on a database
 * shaped like 6.2, seeded with contacts, keys and segments. Opt-in against an isolated database, like
 * the online-upgrade tests: each run works in a schema of its own and drops it.
 */
const databaseUrl = process.env.ONLINE_UPGRADE_TEST_DATABASE_URL;

const migrationDir = path.resolve(__dirname, "..");
const readSql = (name: string) => readFile(path.join(migrationDir, name, "migration.sql"), "utf8");

// The 6.2 shape of the tables the migration touches, as Prisma created them, plus the columns the
// online index list reads.
const SCHEMA_6_2 = `
  CREATE TYPE "ContactAttributeType" AS ENUM ('default', 'custom');
  CREATE TYPE "ContactAttributeDataType" AS ENUM ('string', 'number', 'date');
  CREATE TABLE "Organization" ("id" text PRIMARY KEY, "name" text NOT NULL);
  CREATE TABLE "Workspace" (
    "id" text PRIMARY KEY, "name" text NOT NULL,
    "organizationId" text NOT NULL REFERENCES "Organization"("id") ON UPDATE CASCADE ON DELETE CASCADE
  );
  CREATE TABLE "User" ("id" text PRIMARY KEY, "isBootstrapAdmin" boolean);
  CREATE TABLE "Contact" (
    "id" text PRIMARY KEY, "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp(3) NOT NULL, "workspaceId" text NOT NULL
  );
  ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "Workspace"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  CREATE INDEX "Contact_workspaceId_idx" ON "Contact"("workspaceId");
  CREATE TABLE "ContactAttributeKey" (
    "id" text PRIMARY KEY, "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp(3) NOT NULL, "name" text, "description" text,
    "type" "ContactAttributeType" NOT NULL DEFAULT 'custom', "key" text NOT NULL,
    "isUnique" boolean NOT NULL DEFAULT false,
    "dataType" "ContactAttributeDataType" NOT NULL DEFAULT 'string', "workspaceId" text NOT NULL
  );
  ALTER TABLE "ContactAttributeKey" ADD CONSTRAINT "ContactAttributeKey_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "Workspace"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  CREATE UNIQUE INDEX "ContactAttributeKey_key_workspaceId_key" ON "ContactAttributeKey"("key", "workspaceId");
  CREATE INDEX "ContactAttributeKey_workspaceId_created_at_idx" ON "ContactAttributeKey"("workspaceId", "created_at");
  CREATE TABLE "ContactAttribute" (
    "id" text PRIMARY KEY,
    "attributeKeyId" text NOT NULL REFERENCES "ContactAttributeKey"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "contactId" text NOT NULL REFERENCES "Contact"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "value" text NOT NULL
  );
  CREATE UNIQUE INDEX "ContactAttribute_contactId_attributeKeyId_key" ON "ContactAttribute"("contactId", "attributeKeyId");
  CREATE INDEX "ContactAttribute_attributeKeyId_value_idx" ON "ContactAttribute"("attributeKeyId", "value");
  CREATE TABLE "Segment" (
    "id" text PRIMARY KEY, "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp(3) NOT NULL, "title" text NOT NULL, "description" text,
    "isPrivate" boolean NOT NULL DEFAULT true, "filters" jsonb NOT NULL DEFAULT '[]', "workspaceId" text NOT NULL
  );
  ALTER TABLE "Segment" ADD CONSTRAINT "Segment_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "Workspace"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  CREATE UNIQUE INDEX "Segment_workspaceId_title_key" ON "Segment"("workspaceId", "title");
  CREATE INDEX "Segment_workspaceId_idx" ON "Segment"("workspaceId");
  CREATE TABLE "Survey" (
    "id" text PRIMARY KEY,
    "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "segmentId" text REFERENCES "Segment"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "ownerId" text, "visibilityPending" boolean NOT NULL DEFAULT false
  );
  CREATE TABLE "Response" ("id" text PRIMARY KEY, "created_at" timestamp(3), "surveyId" text, "contactId" text);
`;

// 30,000 contacts, ids interleaved across workspaces: three large workspaces hold 80%.
const LARGE_WORKSPACES = ["ws_big_1", "ws_big_2", "ws_big_3"];
const SEED = `
  INSERT INTO "Organization" VALUES ('org_a', 'Acme'), ('org_b', 'Beta'), ('org_long', 'Long names');
  INSERT INTO "Workspace" VALUES
    ('ws_small_0', 'Small 0', 'org_a'), ('ws_small_1', 'Small 1', 'org_a'), ('ws_small_2', 'Small 2', 'org_a'),
    ('ws_small_3', 'Small 3', 'org_a'), ('ws_small_4', 'Small 4', 'org_a'),
    ('ws_big_1', 'Big 1', 'org_a'), ('ws_big_2', 'Big 2', 'org_a'), ('ws_big_3', 'Big 3', 'org_a'),
    ('ws_empty', 'No contacts', 'org_a'), ('ws_beta', 'Beta', 'org_b'),
    -- Names longer than a directory name may be: two share their first 100 characters, and a third is
    -- exactly those 100 characters, so it keeps them although its id sorts last.
    ('ws_long_1', repeat('L', 100) || ' one', 'org_long'), ('ws_long_2', repeat('L', 100) || ' two', 'org_long'),
    ('ws_long_z', repeat('L', 100), 'org_long');
  INSERT INTO "Contact" ("id", "updated_at", "workspaceId")
  SELECT 'c' || lpad(n::text, 8, '0'), now(), CASE
      WHEN n % 10 = 0 THEN 'ws_small_' || ((n / 10) % 5)::text
      WHEN n % 10 = 1 THEN 'ws_beta'
      WHEN n % 10 IN (2, 3, 4) THEN 'ws_big_1'
      WHEN n % 10 IN (5, 6, 7) THEN 'ws_big_2'
      ELSE 'ws_big_3' END
  FROM generate_series(1, 30000) AS n;
  INSERT INTO "ContactAttributeKey" ("id", "updated_at", "type", "key", "workspaceId")
  SELECT 'key_' || w."id" || '_' || k."key", now(), k."type"::"ContactAttributeType", k."key", w."id"
  FROM "Workspace" w
  CROSS JOIN (VALUES ('userId', 'default'), ('email', 'default'), ('plan', 'custom')) AS k("key", "type");
  INSERT INTO "ContactAttribute" ("id", "attributeKeyId", "contactId", "value")
  SELECT 'attr_' || c."id", 'key_' || c."workspaceId" || '_userId', c."id", 'user-' || c."id" FROM "Contact" c;
  INSERT INTO "Segment" ("id", "updated_at", "title", "isPrivate", "workspaceId") VALUES
    ('seg_public', now(), 'Power users', false, 'ws_small_0'),
    ('seg_private', now(), 'survey_1', true, 'ws_small_0'),
    ('seg_beta', now(), 'Power users', false, 'ws_beta'),
    ('seg_empty', now(), 'Nobody yet', false, 'ws_empty');
  INSERT INTO "Survey" ("id", "workspaceId", "segmentId") VALUES ('survey_1', 'ws_small_0', 'seg_private');
`;

describe.runIf(databaseUrl)("contact directory migration against PostgreSQL", () => {
  const schema = `contact_directories_${randomUUID().replaceAll("-", "")}`;
  const client = new Client(databaseUrl ? getPgConnectionConfig(databaseUrl) : undefined);
  let scopedUrl: string;
  let prisma: PrismaClient;

  const rows = async <T extends Record<string, unknown>>(sql: string, values: unknown[] = []) =>
    (await client.query<T>(sql, values)).rows;
  const directoryOf = async (workspaceId: string) =>
    (
      await rows<{ contactDirectoryId: string | null }>(
        `SELECT "contactDirectoryId" FROM "Workspace" WHERE "id" = $1`,
        [workspaceId]
      )
    )[0]?.contactDirectoryId;
  // Rows whose directory is not their workspace's: none once the migration is done.
  const misplaced = (table: string) =>
    rows<{ id: string }>(
      `SELECT t."id" FROM "${table}" t JOIN "Workspace" w ON w."id" = t."workspaceId"
       WHERE t."directoryId" IS DISTINCT FROM w."contactDirectoryId"`
    );
  const runCreateDirectories = () =>
    prisma.$transaction((tx) => createContactDirectories.run!({ prisma, tx }), { timeout: 60_000 });
  const runBackfill = (signal = new AbortController().signal, client_ = prisma) =>
    backfillContactDirectories.run({ prisma: client_, signal });

  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(SCHEMA_6_2);
    await client.query(SEED);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    scopedUrl = url.toString();
    // Imported only when the test runs: the generated client is rebuilt by the package build, which can
    // run alongside the unit tests that skip this file.
    const [{ PrismaClient }, { createPrismaPgAdapter }] = await Promise.all([
      import("../../src/prisma"),
      import("../../src/prisma-adapter"),
    ]);
    prisma = new PrismaClient({ adapter: createPrismaPgAdapter(scopedUrl).adapter });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  test("the schema step applies twice, changes no row, and leaves 6.2 writes working", async () => {
    const sql = await readSql("20261123120000_add_contact_directories");
    await client.query(sql);
    await client.query(sql);

    expect(await rows(`SELECT 1 FROM "ContactDirectory"`)).toHaveLength(0);
    expect(await rows(`SELECT 1 FROM "Contact" WHERE "directoryId" IS NOT NULL`)).toHaveLength(0);

    // A 6.2 pod writes before any directory exists: the row keeps no directory, for the backfill.
    await client.query(
      `INSERT INTO "Contact" ("id", "updated_at", "workspaceId") VALUES ('c_old_pod_early', now(), 'ws_small_1')`
    );
    expect(
      (
        await rows<{ directoryId: string | null }>(
          `SELECT "directoryId" FROM "Contact" WHERE "id" = 'c_old_pod_early'`
        )
      )[0].directoryId
    ).toBeNull();
  });

  test("every workspace gets its own directory named after it, with its keys and segments", async () => {
    await runCreateDirectories();
    await runCreateDirectories();

    const directories = await rows<{
      id: string;
      name: string;
      matchingKey: string;
      organizationId: string;
      workspaceId: string;
      workspaceName: string;
      workspaceOrganizationId: string;
    }>(
      `SELECT d."id", d."name", d."matchingKey"::text AS "matchingKey", d."organizationId",
              w."id" AS "workspaceId", w."name" AS "workspaceName", w."organizationId" AS "workspaceOrganizationId"
       FROM "ContactDirectory" d JOIN "Workspace" w ON w."contactDirectoryId" = d."id"`
    );
    // Thirteen workspaces, the ones with no contacts included; a second run made none.
    expect(await rows(`SELECT 1 FROM "ContactDirectory"`)).toHaveLength(13);
    expect(directories).toHaveLength(13);
    expect(new Set(directories.map((d) => d.id)).size).toBe(13);
    const nameOf = Object.fromEntries(directories.map((d) => [d.workspaceId, d.name]));
    for (const directory of directories) {
      if (directory.organizationId !== "org_long") expect(directory.name).toBe(directory.workspaceName);
      expect(directory.matchingKey).toBe("email");
      expect(directory.organizationId).toBe(directory.workspaceOrganizationId);
      expect(directory.id).toMatch(/^[0-9a-z]+$/);
    }
    // Cut to 100 characters; the exact match keeps them, the others take a suffix in id order.
    expect(nameOf).toMatchObject({
      ws_long_z: "L".repeat(100),
      ws_long_1: `${"L".repeat(96)} (2)`,
      ws_long_2: `${"L".repeat(96)} (3)`,
    });

    expect(await misplaced("ContactAttributeKey")).toEqual([]);
    expect(await misplaced("Segment")).toEqual([]);
    expect(await rows(`SELECT 1 FROM "Segment" WHERE "directoryId" IS NULL`)).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ directoriesCreated: 13 }),
      expect.any(String)
    );
  });

  test("the contact backfill does the small workspaces first, resumes after a stop, and is safe to rerun", async () => {
    // A contact some later code already placed in another directory is left alone.
    const elsewhere = await directoryOf("ws_empty");
    await client.query(`UPDATE "Contact" SET "directoryId" = $1 WHERE "id" = 'c00000010'`, [elsewhere]);

    // Stop the run after its first batch.
    const controller = new AbortController();
    let batches = 0;
    const stopAfterFirstBatch = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property !== "$queryRaw") return Reflect.get(target, property, receiver) as unknown;
        return async (query: TemplateStringsArray, ...values: unknown[]) => {
          const result = await target.$queryRaw(query, ...values);
          if (query.join("").includes(`UPDATE "Contact"`) && ++batches === 1) controller.abort();
          return result;
        };
      },
    });
    await expect(runBackfill(controller.signal, stopAfterFirstBatch)).rejects.toThrow();

    const afterStop = await rows<{ workspaceId: string; filled: number }>(
      `SELECT "workspaceId", count(*)::int AS "filled" FROM "Contact"
       WHERE "directoryId" IS NOT NULL AND "id" <> 'c00000010' GROUP BY 1`
    );
    const filledWorkspaces = afterStop.map((row) => row.workspaceId);
    expect(filledWorkspaces.length).toBeGreaterThan(0);
    expect(filledWorkspaces.every((id) => !LARGE_WORKSPACES.includes(id))).toBe(true);

    // The next deploy resumes and finishes.
    await runBackfill();
    expect(await misplaced("Contact")).toEqual([{ id: "c00000010" }]);
    expect(await rows(`SELECT 1 FROM "Contact" WHERE "directoryId" IS NULL`)).toHaveLength(0);

    // A rerun finds nothing left to write.
    const before = await rows(`SELECT "id", "directoryId", "updated_at" FROM "Contact" ORDER BY "id"`);
    await runBackfill();
    expect(await rows(`SELECT "id", "directoryId", "updated_at" FROM "Contact" ORDER BY "id"`)).toEqual(
      before
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ contactsWithoutDirectory: 0, directoriesWithContacts: 10 }),
      expect.any(String)
    );
    // Put the hand-placed contact back for the checks below.
    await client.query(`UPDATE "Contact" SET "directoryId" = $1 WHERE "id" = 'c00000010'`, [
      await directoryOf("ws_small_1"),
    ]);
  });

  test("the indexes and foreign keys complete, and the old per-workspace rules still hold", async () => {
    await ensureOnlineIndexes(scopedUrl);
    const validate = await readSql("20261123120003_validate_contact_directory_foreign_keys");
    await client.query(validate);
    await client.query(validate);

    const notValid = await rows<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND NOT convalidated`
    );
    expect(notValid).toEqual([]);

    // Counts by workspace are what they were: today's code still reads by workspace.
    const perWorkspace = await rows<{ workspaceId: string; contacts: number }>(
      `SELECT "workspaceId", count(*)::int AS contacts FROM "Contact" GROUP BY 1 ORDER BY 1`
    );
    expect(Object.fromEntries(perWorkspace.map((row) => [row.workspaceId, row.contacts]))).toEqual({
      ws_beta: 3000,
      ws_big_1: 9000,
      ws_big_2: 9000,
      ws_big_3: 6000,
      ws_small_0: 600,
      ws_small_1: 601,
      ws_small_2: 600,
      ws_small_3: 600,
      ws_small_4: 600,
    });

    await expect(
      client.query(
        `INSERT INTO "ContactAttributeKey" ("id", "updated_at", "key", "workspaceId") VALUES ('dup', now(), 'plan', 'ws_beta')`
      )
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      client.query(
        `INSERT INTO "Segment" ("id", "updated_at", "title", "workspaceId") VALUES ('dup', now(), 'Power users', 'ws_beta')`
      )
    ).rejects.toMatchObject({ code: "23505" });
  });

  test("rows a 6.2 pod writes after the migration get their workspace's directory", async () => {
    await client.query(`
      INSERT INTO "Contact" ("id", "updated_at", "workspaceId") VALUES ('c_old_pod', now(), 'ws_small_2');
      INSERT INTO "ContactAttributeKey" ("id", "updated_at", "key", "workspaceId") VALUES ('key_old_pod', now(), 'tier', 'ws_small_2');
      INSERT INTO "Segment" ("id", "updated_at", "title", "workspaceId") VALUES ('seg_old_pod', now(), 'New', 'ws_small_2');
    `);
    const directory = await directoryOf("ws_small_2");
    for (const [table, id] of [
      ["Contact", "c_old_pod"],
      ["ContactAttributeKey", "key_old_pod"],
      ["Segment", "seg_old_pod"],
    ]) {
      const [row] = await rows<{ directoryId: string | null }>(
        `SELECT "directoryId" FROM "${table}" WHERE "id" = $1`,
        [id]
      );
      expect(row.directoryId).toBe(directory);
    }

    // A directory a writer sets is kept.
    const other = await directoryOf("ws_small_3");
    await client.query(
      `INSERT INTO "Contact" ("id", "updated_at", "workspaceId", "directoryId") VALUES ('c_new_pod', now(), 'ws_small_2', $1)`,
      [other]
    );
    expect(
      (await rows<{ directoryId: string }>(`SELECT "directoryId" FROM "Contact" WHERE "id" = 'c_new_pod'`))[0]
        .directoryId
    ).toBe(other);
    await client.query(`DELETE FROM "Contact" WHERE "id" = 'c_new_pod'`);
  });

  test("deleting an unshared workspace removes its directory, contacts, keys and segments", async () => {
    const directory = await directoryOf("ws_small_4");
    await client.query(`DELETE FROM "Workspace" WHERE "id" = 'ws_small_4'`);

    expect(await rows(`SELECT 1 FROM "ContactDirectory" WHERE "id" = $1`, [directory])).toHaveLength(0);
    for (const table of ["Contact", "ContactAttributeKey", "Segment"]) {
      expect(
        await rows(`SELECT 1 FROM "${table}" WHERE "directoryId" = $1 OR "workspaceId" IS NULL`, [directory])
      ).toHaveLength(0);
    }
    // Other workspaces are untouched.
    expect(await rows(`SELECT 1 FROM "Contact" WHERE "workspaceId" = 'ws_small_3'`)).toHaveLength(600);
  });

  test("a shared directory outlives one of its workspaces and goes with the last", async () => {
    const directory = await directoryOf("ws_small_3");
    await client.query(
      `INSERT INTO "Workspace" ("id", "name", "organizationId", "contactDirectoryId") VALUES ('ws_shared', 'Shared', 'org_a', $1)`,
      [directory]
    );
    await client.query(
      `INSERT INTO "Contact" ("id", "updated_at", "workspaceId") VALUES ('c_shared', now(), 'ws_shared')`
    );

    await client.query(`DELETE FROM "Workspace" WHERE "id" = 'ws_shared'`);
    expect(await rows(`SELECT 1 FROM "ContactDirectory" WHERE "id" = $1`, [directory])).toHaveLength(1);
    const [shared] = await rows<{ workspaceId: string | null; directoryId: string }>(
      `SELECT "workspaceId", "directoryId" FROM "Contact" WHERE "id" = 'c_shared'`
    );
    expect(shared).toEqual({ workspaceId: null, directoryId: directory });

    await client.query(`DELETE FROM "Workspace" WHERE "id" = 'ws_small_3'`);
    expect(await rows(`SELECT 1 FROM "ContactDirectory" WHERE "id" = $1`, [directory])).toHaveLength(0);
    expect(await rows(`SELECT 1 FROM "Contact" WHERE "directoryId" = $1`, [directory])).toHaveLength(0);
  });

  test("a workspace with no directory keeps its rows without one and removes them when deleted", async () => {
    // A workspace a 6.2 pod creates during the rollout has no directory.
    await client.query(`
      INSERT INTO "Workspace" VALUES ('ws_rollout', 'Rollout', 'org_a');
      INSERT INTO "Contact" ("id", "updated_at", "workspaceId") VALUES ('c_rollout', now(), 'ws_rollout');
      INSERT INTO "ContactAttributeKey" ("id", "updated_at", "key", "workspaceId") VALUES ('key_rollout', now(), 'userId', 'ws_rollout');
      INSERT INTO "Segment" ("id", "updated_at", "title", "workspaceId") VALUES ('seg_rollout', now(), 'Rollout', 'ws_rollout');
    `);
    expect(
      await rows(
        `SELECT 1 FROM "Contact" WHERE "id" = 'c_rollout' AND "directoryId" IS NULL
         UNION ALL SELECT 1 FROM "ContactAttributeKey" WHERE "id" = 'key_rollout' AND "directoryId" IS NULL
         UNION ALL SELECT 1 FROM "Segment" WHERE "id" = 'seg_rollout' AND "directoryId" IS NULL`
      )
    ).toHaveLength(3);

    await client.query(`DELETE FROM "Workspace" WHERE "id" = 'ws_rollout'`);
    expect(
      await rows(
        `SELECT 1 FROM "Contact" WHERE "id" = 'c_rollout'
         UNION ALL SELECT 1 FROM "ContactAttributeKey" WHERE "id" = 'key_rollout'
         UNION ALL SELECT 1 FROM "Segment" WHERE "id" = 'seg_rollout'`
      )
    ).toHaveLength(0);
  });

  test("deleting an organization removes its workspaces and directories", async () => {
    await client.query(`DELETE FROM "Organization" WHERE "id" = 'org_b'`);
    expect(await rows(`SELECT 1 FROM "ContactDirectory" WHERE "organizationId" = 'org_b'`)).toHaveLength(0);
    expect(
      await rows(`SELECT 1 FROM "Contact" WHERE "workspaceId" IS NULL OR "directoryId" IS NULL`)
    ).toHaveLength(0);
    expect(await rows(`SELECT 1 FROM "Segment" WHERE "id" = 'seg_beta'`)).toHaveLength(0);
  });
});
