import { describe, expect, test, vi } from "vitest";
import { backfillMatrixConditionIdRows } from "./migration";

vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const grid = {
  id: "grid",
  type: "matrix",
  rows: [{ id: "row_netflix" }, { id: "row_disney" }],
  columns: [{ id: "col_poor" }, { id: "col_good" }],
};
const positionsOnly = () => ({
  id: "cond",
  leftOperand: { type: "element", value: "grid", meta: { row: "1" } },
  operator: "equals",
  rightOperand: { type: "static", value: "1" },
});
const blocks = () => [
  {
    id: "b1",
    name: "b1",
    elements: [grid],
    logic: [
      { id: "r", conditions: { id: "g", connector: "and", conditions: [positionsOnly()] }, actions: [] },
    ],
  },
];

const survey = (id: string) => ({ id, updatedAt: "2026-01-01 00:00:00.000", blocks: blocks() });
const quota = (id: string) => ({
  id,
  updatedAt: "2026-01-01 00:00:00.000",
  logic: { connector: "and", conditions: [positionsOnly()] },
  blocks: blocks(),
});

type TRow = { id: string; updatedAt: string };
type TWriteOutcome = (table: string, ids: string[]) => string[];

/**
 * A stand-in for the Prisma handle that answers by the shape of the SQL: the keyset page read, the
 * by-id re-read and the compare-and-set UPDATE (whose `RETURNING` is the rows still at the
 * `updated_at` the migration read, i.e. the ones no old pod edited in between), for both tables.
 * Written rows leave the candidate set, as the SQL predicate makes them do.
 */
const fakePrisma = (
  tables: { Survey: TRow[]; SurveyQuota: TRow[] },
  written: TWriteOutcome = (_t, ids) => ids
) => {
  const done = new Set<string>();
  const updates: { table: string; ids: string[]; values: unknown[] }[] = [];
  const tableOf = (sql: string) => (sql.includes(`"SurveyQuota"`) ? "SurveyQuota" : "Survey");
  const $queryRawUnsafe = vi.fn((sql: string, ...params: unknown[]): Promise<unknown[]> => {
    const table = tableOf(sql);
    const rows = tables[table].filter((row) => !done.has(row.id));
    if (sql.trimStart().startsWith("UPDATE")) {
      const ids = params[0] as string[];
      const values = (params[2] as string[]).map((value) => JSON.parse(value) as unknown);
      updates.push({ table, ids, values });
      const won = written(table, ids);
      won.forEach((id) => done.add(id));
      return Promise.resolve(won.map((id) => ({ id })));
    }
    if (sql.includes("= ANY($1::text[])")) {
      return Promise.resolve(rows.filter((row) => (params[0] as string[]).includes(row.id)));
    }
    const [cursor, limit] = params as [string, number];
    return Promise.resolve(rows.filter((row) => row.id > cursor).slice(0, limit));
  });
  return { prisma: { $queryRawUnsafe } as never, updates, $queryRawUnsafe };
};

describe("backfillMatrixConditionIdRows", () => {
  test("writes the ids into block logic and quota conditions, keeping the positions", async () => {
    const { prisma, updates } = fakePrisma({ Survey: [survey("s1")], SurveyQuota: [quota("q1")] });

    const stats = await backfillMatrixConditionIdRows(prisma);

    const expected = {
      leftOperand: { meta: { row: "1", rowId: "row_disney" } },
      rightOperand: { value: "1", columnId: "col_good" },
    };
    const [surveyWrite, quotaWrite] = updates;
    expect(surveyWrite.table).toBe("Survey");
    expect(
      (surveyWrite.values[0] as ReturnType<typeof blocks>)[0].logic[0].conditions.conditions[0]
    ).toMatchObject(expected);
    expect(quotaWrite.table).toBe("SurveyQuota");
    expect((quotaWrite.values[0] as { conditions: unknown[] }).conditions[0]).toMatchObject(expected);
    expect(stats).toMatchObject({ surveys: { updated: 1 }, quotas: { updated: 1 } });
  });

  test("a re-run over a backfilled database writes nothing", async () => {
    const synced = { ...survey("s1") };
    const first = fakePrisma({ Survey: [synced], SurveyQuota: [] });
    await backfillMatrixConditionIdRows(first.prisma);
    const backfilled = { ...synced, blocks: first.updates[0].values[0] as ReturnType<typeof blocks> };

    // The candidate SQL would no longer select it; even if it did, the planner finds nothing to do.
    const second = fakePrisma({ Survey: [backfilled], SurveyQuota: [] });
    const stats = await backfillMatrixConditionIdRows(second.prisma);

    expect(second.updates).toEqual([]);
    expect(stats.surveys).toMatchObject({ scanned: 1, updated: 0, unchanged: 1 });
  });

  test("a row an old pod edited mid-run is re-read and written on the retry", async () => {
    let attempt = 0;
    const { prisma, updates } = fakePrisma(
      { Survey: [survey("a"), survey("b")], SurveyQuota: [quota("q")] },
      (table, ids) => {
        if (table !== "Survey") return ids;
        attempt += 1;
        return attempt === 1 ? ids.filter((id) => id !== "b") : ids;
      }
    );

    const stats = await backfillMatrixConditionIdRows(prisma);

    expect(updates.filter((u) => u.table === "Survey").map((u) => u.ids)).toEqual([["a", "b"], ["b"]]);
    expect(stats.surveys).toMatchObject({ updated: 2, raceRetries: 1, skipped: [] });
  });

  test("a quota that keeps changing is retried three times, then skipped and reported", async () => {
    const { prisma, updates } = fakePrisma(
      { Survey: [], SurveyQuota: [quota("q1"), quota("q2")] },
      (table, ids) => (table === "SurveyQuota" ? ids.filter((id) => id !== "q2") : ids)
    );

    const stats = await backfillMatrixConditionIdRows(prisma);

    expect(updates).toHaveLength(4); // the page write plus three retries of "q2"
    expect(stats.quotas).toMatchObject({ updated: 1, raceRetries: 3, skipped: ["q2"] });
  });

  test("reads in keyset pages, so memory stays bounded however many rows there are", async () => {
    const many = Array.from({ length: 320 }, (_, i) => survey(`s${i.toString().padStart(4, "0")}`));
    const { prisma, $queryRawUnsafe } = fakePrisma({ Survey: many, SurveyQuota: [] });

    const stats = await backfillMatrixConditionIdRows(prisma);

    const pageReads = $queryRawUnsafe.mock.calls.filter(
      ([sql]) => !sql.trimStart().startsWith("UPDATE") && sql.includes(`"Survey" x WHERE x."id" > $1`)
    );
    // 150 + 150 + 20, then the empty page that ends the walk.
    expect(pageReads.map(([, cursor, limit]) => [cursor, limit])).toEqual([
      ["", 150],
      ["s0149", 150],
      ["s0299", 150],
      ["s0319", 150],
    ]);
    expect(stats.surveys).toMatchObject({ scanned: 320, updated: 320 });
  });

  test("empty tables do nothing", async () => {
    const { prisma, updates } = fakePrisma({ Survey: [], SurveyQuota: [] });

    expect(await backfillMatrixConditionIdRows(prisma)).toMatchObject({
      surveys: { scanned: 0, updated: 0 },
      quotas: { scanned: 0, updated: 0 },
    });
    expect(updates).toEqual([]);
  });
});
