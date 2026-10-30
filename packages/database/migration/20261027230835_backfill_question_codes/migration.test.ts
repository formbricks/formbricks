import { describe, expect, test, vi } from "vitest";
import { backfillQuestionCodeRows } from "./migration";
import type { TSurveyCodesRow } from "./utils";

vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const uncoded = (id: string): TSurveyCodesRow => ({
  id,
  updatedAt: "2026-01-01 00:00:00.000",
  blocks: [{ id: "b1", name: "b1", elements: [{ id: "e1", type: "openText" }] }],
  questions: [],
  variables: [],
  hiddenFields: { enabled: false },
  linkedNames: null,
});

type TWriteOutcome = (ids: string[]) => string[];

/**
 * A stand-in for the Prisma handle that answers by the shape of the SQL: the keyset page read, the
 * by-id re-read, and the compare-and-set UPDATE (whose `RETURNING` is the rows that were still at the
 * `updated_at` the migration read, i.e. the ones no old pod edited in between).
 */
const fakePrisma = (rows: TSurveyCodesRow[], written: TWriteOutcome) => {
  const updates: string[][] = [];
  const $queryRawUnsafe = vi.fn((sql: string, ...params: unknown[]): Promise<unknown[]> => {
    if (sql.startsWith("UPDATE")) {
      const ids = params[0] as string[];
      updates.push(ids);
      return Promise.resolve(written(ids).map((id) => ({ id })));
    }
    if (sql.includes("= ANY($1::text[])")) {
      return Promise.resolve(rows.filter((r) => (params[0] as string[]).includes(r.id)));
    }
    const cursor = params[0] as string;
    return Promise.resolve(rows.filter((r) => r.id > cursor));
  });
  return { prisma: { $queryRawUnsafe } as never, updates, $queryRawUnsafe };
};

describe("backfillQuestionCodeRows: rows an old pod edited while the migration ran", () => {
  test("a row whose compare-and-set lost is re-read and written on the retry", async () => {
    let attempt = 0;
    const { prisma, updates } = fakePrisma([uncoded("a"), uncoded("b")], (ids) => {
      attempt += 1;
      // First write: "b" was edited by an old pod, so only "a" matches its updated_at.
      return attempt === 1 ? ids.filter((id) => id !== "b") : ids;
    });

    const stats = await backfillQuestionCodeRows(prisma);

    expect(updates).toEqual([["a", "b"], ["b"]]);
    expect(stats).toMatchObject({ updatedSurveys: 2, raceRetries: 1, skippedSurveys: [] });
  });

  test("a row that keeps changing is retried three times, then skipped and reported, not looped on", async () => {
    const { prisma, updates } = fakePrisma([uncoded("a"), uncoded("b")], (ids) =>
      ids.filter((id) => id !== "b")
    );

    const stats = await backfillQuestionCodeRows(prisma);

    expect(updates).toHaveLength(4); // the page write plus three retries of "b"
    expect(stats.skippedSurveys).toEqual(["b"]);
    expect(stats).toMatchObject({ updatedSurveys: 1, raceRetries: 3 });
  });

  test("an empty table does nothing", async () => {
    const { prisma, updates } = fakePrisma([], () => []);
    expect(await backfillQuestionCodeRows(prisma)).toMatchObject({ scannedSurveys: 0, updatedSurveys: 0 });
    expect(updates).toEqual([]);
  });
});
