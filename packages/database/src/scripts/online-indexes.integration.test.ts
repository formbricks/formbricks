import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getPgConnectionConfig } from "../pg-connection-config";
import { ONLINE_INDEXES, ensureOnlineIndexes } from "./online-indexes";

// Opt-in test against an isolated database, never a cached production task.
const databaseUrl = process.env.ONLINE_UPGRADE_TEST_DATABASE_URL;
describe.runIf(databaseUrl)("online indexes against PostgreSQL", () => {
  const schema = `index_test_${randomUUID().replaceAll("-", "")}`;
  const client = new Client(databaseUrl ? getPgConnectionConfig(databaseUrl) : undefined);
  let scopedUrl: string;
  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(
      'CREATE TABLE "Response" (id text, created_at timestamp, "surveyId" text, "contactId" text)'
    );
    await client.query('CREATE TABLE "User" ("isBootstrapAdmin" boolean)');
    await client.query(
      'CREATE TABLE "Survey" ("workspaceId" text, "ownerId" text, "visibilityPending" boolean)'
    );
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    scopedUrl = url.toString();
  });
  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  test("serializes simultaneous runners and leaves every index valid", async () => {
    await Promise.all([ensureOnlineIndexes(scopedUrl), ensureOnlineIndexes(scopedUrl)]);
    const { rows } = await client.query<{ name: string; valid: boolean }>(`
      SELECT i.relname AS name, x.indisvalid AS valid FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
      WHERE i.relnamespace = current_schema()::regnamespace
    `);
    expect(rows).toHaveLength(ONLINE_INDEXES.length);
    expect(rows.every((row) => row.valid)).toBe(true);
  });

  test("repairs an interrupted invalid build without relaxing bootstrap uniqueness", async () => {
    await client.query('DROP INDEX "User_isBootstrapAdmin_key"');
    await client.query('INSERT INTO "User" VALUES (true), (true)');
    await expect(
      client.query(
        'CREATE UNIQUE INDEX CONCURRENTLY "User_isBootstrapAdmin_key" ON "User" ("isBootstrapAdmin")'
      )
    ).rejects.toThrow();
    await client.query('DELETE FROM "User" WHERE ctid IN (SELECT ctid FROM "User" LIMIT 1)');
    await ensureOnlineIndexes(scopedUrl);
    await expect(client.query('INSERT INTO "User" VALUES (true)')).rejects.toMatchObject({ code: "23505" });
  });
});
