import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { getPgConnectionConfig } from "../../src/pg-connection-config";
import { backfillMatrixConditionIdRows } from "./migration";

vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

/**
 * The backfill's SQL on real PostgreSQL (ENG-6934): the candidate filter (`jsonb_path_exists` over the
 * `jsonb[]` blocks and the quota logic) and the compare-and-set UPDATE on `updated_at`, which the
 * unit test fakes. Opt-in against an isolated database, like the online-upgrade tests: each run
 * works in a schema of its own and drops it.
 */
const databaseUrl = process.env.ONLINE_UPGRADE_TEST_DATABASE_URL;

const UPDATED_AT = "2026-01-01 00:00:00";

const grid = {
  id: "grid",
  type: "matrix",
  rows: [{ id: "row_netflix" }, { id: "row_disney" }],
  columns: [{ id: "col_poor" }, { id: "col_good" }],
};
/** "Disney is rated Good", by positions only: what every condition held before ENG-6934. */
const positionsOnly = () => ({
  id: "cond",
  leftOperand: { type: "element", value: "grid", meta: { row: "1" } },
  operator: "equals",
  rightOperand: { type: "static", value: "1" },
});
const withIds = () => ({
  id: "cond",
  leftOperand: { type: "element", value: "grid", meta: { row: "1", rowId: "row_disney" } },
  operator: "equals",
  rightOperand: { type: "static", value: "1", columnId: "col_good" },
});
const blocks = (condition: unknown, name = "Ratings") => [
  {
    id: "b1",
    name,
    elements: [grid],
    logic: [{ id: "r", conditions: { id: "g", connector: "and", conditions: [condition] }, actions: [] }],
  },
];
const plainBlocks = () => [{ id: "b1", name: "Plain", elements: [{ id: "q", type: "openText" }] }];

describe.runIf(databaseUrl)("matrix condition id backfill against PostgreSQL", () => {
  const schema = `backfill_test_${randomUUID().replaceAll("-", "")}`;
  const client = new Client(databaseUrl ? getPgConnectionConfig(databaseUrl) : undefined);
  /** Runs once, between the migration reading a page and writing it: an old pod saving a survey. */
  let beforeFirstSurveyUpdate: (() => Promise<void>) | undefined;

  const prisma = {
    $queryRawUnsafe: async (sql: string, ...params: unknown[]): Promise<unknown[]> => {
      if (sql.trimStart().startsWith("UPDATE") && sql.includes(`"Survey"`) && beforeFirstSurveyUpdate) {
        const oldPodSave = beforeFirstSurveyUpdate;
        beforeFirstSurveyUpdate = undefined;
        await oldPodSave();
      }
      const result = await client.query<Record<string, unknown>>(sql, params);
      return result.rows;
    },
  } as never;

  const insertSurvey = (id: string, value: unknown) =>
    client.query(
      `INSERT INTO "Survey" ("id", "updated_at", "blocks")
       VALUES ($1, $2::timestamp, ARRAY(SELECT jsonb_array_elements($3::jsonb)))`,
      [id, UPDATED_AT, JSON.stringify(value)]
    );
  const readSurvey = async (id: string) =>
    (
      await client.query<{ blocks: ReturnType<typeof blocks>; updatedAt: string }>(
        `SELECT to_jsonb("blocks") AS "blocks", "updated_at"::text AS "updatedAt" FROM "Survey" WHERE "id" = $1`,
        [id]
      )
    ).rows[0];
  const conditionOf = (survey: { blocks: ReturnType<typeof blocks> }) =>
    survey.blocks[0].logic[0].conditions.conditions[0];

  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    // The columns the backfill reads and writes, typed as Prisma creates them.
    await client.query(
      `CREATE TABLE "Survey" ("id" text PRIMARY KEY, "updated_at" timestamp(3) NOT NULL, "blocks" jsonb[] NOT NULL DEFAULT ARRAY[]::jsonb[])`
    );
    await client.query(
      `CREATE TABLE "SurveyQuota" ("id" text PRIMARY KEY, "updated_at" timestamp(3) NOT NULL, "logic" jsonb NOT NULL, "surveyId" text NOT NULL REFERENCES "Survey"("id"))`
    );

    await insertSurvey("s1_needs_ids", blocks(positionsOnly()));
    await insertSurvey("s2_old_pod", blocks(positionsOnly()));
    await insertSurvey("s3_has_ids", blocks(withIds()));
    await insertSurvey("s4_no_matrix", plainBlocks());
    await client.query(
      `INSERT INTO "SurveyQuota" VALUES ('q1_needs_ids', $1::timestamp, $2::jsonb, 's1_needs_ids')`,
      [UPDATED_AT, JSON.stringify({ connector: "and", conditions: [positionsOnly()] })]
    );
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  test("adds the ids to candidates only, keeps an old pod's mid-upgrade save, and writes nothing on a second run", async () => {
    // An old pod renames s2's block after the migration read it, before the migration writes it.
    beforeFirstSurveyUpdate = async () => {
      await client.query(
        `UPDATE "Survey" SET "blocks" = ARRAY(SELECT jsonb_array_elements($1::jsonb)),
           "updated_at" = "updated_at" + interval '1 second' WHERE "id" = 's2_old_pod'`,
        [JSON.stringify(blocks(positionsOnly(), "Ratings (edited)"))]
      );
    };

    const first = await backfillMatrixConditionIdRows(prisma);

    // The candidate filter: only the two surveys still on positions, and the one quota.
    expect(first.surveys).toMatchObject({ scanned: 2, updated: 2, raceRetries: 1, skipped: [] });
    expect(first.quotas).toMatchObject({ scanned: 1, updated: 1, skipped: [] });

    const needsIds = await readSurvey("s1_needs_ids");
    expect(conditionOf(needsIds)).toEqual(withIds());
    // Raw SQL: the migration leaves `updated_at` alone, so a v3 caller's precondition stays valid.
    expect(needsIds.updatedAt).toBe(`${UPDATED_AT}`);

    // The compare-and-set: the old pod's save is not overwritten; the row is re-read and synced.
    const oldPod = await readSurvey("s2_old_pod");
    expect(oldPod.blocks[0].name).toBe("Ratings (edited)");
    expect(conditionOf(oldPod)).toEqual(withIds());

    const quota = await client.query<{ logic: { conditions: unknown[] } }>(
      `SELECT "logic" FROM "SurveyQuota" WHERE "id" = 'q1_needs_ids'`
    );
    expect(quota.rows[0].logic.conditions[0]).toEqual(withIds());

    // Idempotent: a synced row is no longer a candidate.
    const second = await backfillMatrixConditionIdRows(prisma);
    expect(second.surveys).toMatchObject({ scanned: 0, updated: 0 });
    expect(second.quotas).toMatchObject({ scanned: 0, updated: 0 });
    expect(conditionOf(await readSurvey("s3_has_ids"))).toEqual(withIds());
  });
});
