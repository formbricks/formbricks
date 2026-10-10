import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  type TRetentionRunItemRow,
  type TRetentionRunRow,
  countRetentionExportRows,
  iterateRetentionExportRows,
  listRetentionRunKeysetPage,
} from "./runs-service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { $queryRaw: vi.fn() } }));

/**
 * The statement a mocked `$queryRaw` call would have sent, flattened with its fragments, so a test can
 * read the SQL and its bound values. Ordering and paging against a real database are proven in
 * `runs-service.integration.test.ts`; these tests pin how each query is built and how results are walked.
 */
const statement = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const queryRaw = () => vi.mocked(prisma.$queryRaw);
const statements = () => queryRaw().mock.calls.map(statement);

const ORG_ID = "clorg11111111111111111111";

const run = (id: string, startedAt: string): TRetentionRunRow => ({
  id,
  entity: "surveys",
  startedAt: new Date(startedAt),
  finishedAt: null,
  notifiedCount: 0,
  archivedCount: 1,
  deletedCount: 0,
  skippedCount: 0,
  hasChanges: true,
});

const item = (runId: string, id: string): TRetentionRunItemRow => ({
  id,
  runId,
  targetType: "survey",
  targetId: `survey_${id}`,
  targetName: null,
  action: "archived",
  count: 1,
  recipient: null,
  skipReason: null,
});

const collect = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const rows: T[] = [];
  for await (const row of iterable) rows.push(row);
  return rows;
};

describe("listRetentionRunKeysetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRaw().mockResolvedValue([] as never);
  });

  test("scopes to the organisation, hides empty runs, orders newest first and fetches one extra row", async () => {
    await listRetentionRunKeysetPage({
      organizationId: ORG_ID,
      includeEmpty: false,
      limit: 25,
      cursor: null,
    });

    const [{ text, values }] = statements();
    expect(text).toContain('WHERE r."organizationId" = ? AND r."hasChanges" = true ORDER BY');
    expect(text).toContain('ORDER BY r."startedAt" DESC, r."id" DESC LIMIT ?');
    expect(values).toStrictEqual([ORG_ID, 26]);
  });

  test("keeps empty runs when asked and continues below the cursor", async () => {
    const cursor = { value: "2030-01-02T02:00:00.000Z", id: "clrun2222222222222222222" };

    await listRetentionRunKeysetPage({ organizationId: ORG_ID, includeEmpty: true, limit: 10, cursor });

    const [{ text, values }] = statements();
    expect(text).not.toContain('r."hasChanges" = true');
    expect(text).toContain('(r."startedAt", r."id") < (?, ?)');
    expect(values).toStrictEqual([ORG_ID, new Date(cursor.value), cursor.id, 11]);
  });
});

describe("countRetentionExportRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("counts runs joined to their items in range, stopping one past the cap", async () => {
    queryRaw().mockResolvedValue([{ rows: 42 }] as never);
    const from = new Date("2030-01-01T00:00:00.000Z");
    const to = new Date("2030-02-01T00:00:00.000Z");

    await expect(countRetentionExportRows({ organizationId: ORG_ID, from, to }, 100)).resolves.toBe(42);

    const [{ text, values }] = statements();
    expect(text).toContain('LEFT JOIN "RetentionRunItem" i ON i."runId" = r."id"');
    expect(text).toContain('r."startedAt" >= ? AND r."startedAt" < ?');
    expect(values).toStrictEqual([ORG_ID, from, to, 101]);
  });

  test("leaves an open range unbounded and reads no row as zero", async () => {
    queryRaw().mockResolvedValue([] as never);

    await expect(countRetentionExportRows({ organizationId: ORG_ID, from: null, to: null }, 5)).resolves.toBe(
      0
    );

    const [{ text, values }] = statements();
    expect(text).not.toContain('r."startedAt" >=');
    expect(text).not.toContain('r."startedAt" <');
    expect(values).toStrictEqual([ORG_ID, 6]);
  });
});

describe("iterateRetentionExportRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("walks runs oldest first in batches, each followed by its items, and an itemless run once", async () => {
    const runA = run("run_a", "2030-01-01T02:00:00.000Z");
    const runB = run("run_b", "2030-01-02T02:00:00.000Z");
    const runC = run("run_c", "2030-01-03T02:00:00.000Z");
    queryRaw()
      // First run batch is full, so the walk continues past run_b.
      .mockResolvedValueOnce([runA, runB] as never)
      // Its items arrive over two pages; the second is short, which ends the item walk.
      .mockResolvedValueOnce([item("run_a", "i1"), item("run_a", "i2")] as never)
      .mockResolvedValueOnce([item("run_a", "i3")] as never)
      // A short second batch ends the run walk; run_c has no items.
      .mockResolvedValueOnce([runC] as never)
      .mockResolvedValueOnce([] as never);

    const rows = await collect(
      iterateRetentionExportRows(
        { organizationId: ORG_ID, from: null, to: null },
        { runBatchSize: 2, itemBatchSize: 2 }
      )
    );

    expect(rows.map(({ run, item }) => [run.id, item?.id ?? null])).toStrictEqual([
      ["run_a", "i1"],
      ["run_a", "i2"],
      ["run_a", "i3"],
      ["run_b", null],
      ["run_c", null],
    ]);

    const [firstRuns, firstItems, nextItems, nextRuns, lastItems] = statements();
    expect(statements()).toHaveLength(5);

    expect(firstRuns.text).toContain('ORDER BY r."startedAt" ASC, r."id" ASC LIMIT ?');
    expect(firstRuns.text).not.toContain('(r."startedAt", r."id") >');
    expect(firstRuns.values).toStrictEqual([ORG_ID, 2]);

    expect(firstItems.text).toContain('WHERE i."runId" IN (?,?)');
    expect(firstItems.text).not.toContain('(i."runId", i."id") >');
    expect(firstItems.values).toStrictEqual(["run_a", "run_b", 2]);

    expect(nextItems.text).toContain('AND (i."runId", i."id") > (?, ?)');
    expect(nextItems.values).toStrictEqual(["run_a", "run_b", "run_a", "i2", 2]);

    expect(nextRuns.text).toContain('(r."startedAt", r."id") > (?, ?)');
    expect(nextRuns.values).toStrictEqual([ORG_ID, runB.startedAt, "run_b", 2]);

    expect(lastItems.values).toStrictEqual(["run_c", 2]);
  });

  test("stops after one query when the range holds no runs", async () => {
    queryRaw().mockResolvedValueOnce([] as never);
    const from = new Date("2030-01-01T00:00:00.000Z");

    await expect(
      collect(iterateRetentionExportRows({ organizationId: ORG_ID, from, to: null }))
    ).resolves.toStrictEqual([]);

    expect(statements()).toHaveLength(1);
    expect(statements()[0].values).toStrictEqual([ORG_ID, from, 100]);
  });

  test("ends the run walk on a full batch followed by an empty one", async () => {
    const runA = run("run_a", "2030-01-01T02:00:00.000Z");
    queryRaw()
      .mockResolvedValueOnce([runA] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const rows = await collect(
      iterateRetentionExportRows({ organizationId: ORG_ID, from: null, to: null }, { runBatchSize: 1 })
    );

    expect(rows.map(({ run, item }) => [run.id, item])).toStrictEqual([["run_a", null]]);
    expect(statements()).toHaveLength(3);
  });
});
