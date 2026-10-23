import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  type TRetentionRunRow,
  countRetentionExportRows,
  iterateRetentionExportRows,
  listRetentionRunKeysetPage,
} from "./runs-service";

const BASE = new Date("2030-01-01T02:00:00.000Z");
const TIE_GROUPS = 4;
const PER_GROUP = 5;

const at = (group: number) => new Date(BASE.getTime() + group * 24 * 60 * 60 * 1000);
// Ids sort against time across groups (later runs get smaller ids) and against insertion order inside
// each tie group, so a walk that leans on the id alone, or on insertion order, skips or repeats rows.
const runId = (group: number, index: number, prefix = "clrun") =>
  `${prefix}${String(TIE_GROUPS - group)}${String(PER_GROUP - index).padStart(19, "0")}`;

const seedRuns = async (organizationId: string, prefix = "clrun") => {
  const rows = [];
  for (let group = 0; group < TIE_GROUPS; group++) {
    for (let index = 0; index < PER_GROUP; index++) {
      rows.push({
        id: runId(group, index, prefix),
        organizationId,
        entity: "surveys" as const,
        startedAt: at(group),
        // Every other run changed nothing.
        hasChanges: index % 2 === 0,
      });
    }
  }
  await prisma.retentionRun.createMany({ data: rows });
  return rows;
};

const walk = async (organizationId: string, includeEmpty: boolean, limit: number) => {
  const seen: TRetentionRunRow[] = [];
  let cursor: { value: string; id: string } | null = null;
  for (let pages = 0; pages < 100; pages++) {
    const rows = await listRetentionRunKeysetPage({ organizationId, includeEmpty, limit, cursor });
    const page = rows.slice(0, limit);
    seen.push(...page);
    if (rows.length <= limit) return seen;
    const last = page.at(-1)!;
    cursor = { value: last.startedAt.toISOString(), id: last.id };
  }
  throw new Error("walk did not end");
};

const newestFirst = (rows: { id: string; startedAt: Date }[]) =>
  [...rows]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || (a.id < b.id ? 1 : -1))
    .map((row) => row.id);

describe("retention runs service (real Postgres)", () => {
  let organizationId: string;
  let otherOrganizationId: string;

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Retention Org" } })).id;
    otherOrganizationId = (await prisma.organization.create({ data: { name: "Other Org" } })).id;
  });

  test.each([1, 3, 7])(
    "walks History %i at a time without skipping or repeating a run, across tied start times",
    async (limit) => {
      const seeded = await seedRuns(organizationId);
      await seedRuns(otherOrganizationId, "clrux");

      const all = await walk(organizationId, true, limit);
      expect(all.map((run) => run.id)).toEqual(newestFirst(seeded));

      const withChanges = await walk(organizationId, false, limit);
      expect(withChanges.map((run) => run.id)).toEqual(newestFirst(seeded.filter((run) => run.hasChanges)));
    }
  );

  test("exports every run oldest first, each with its items, and one row for a run without items", async () => {
    const [first, second, third] = await Promise.all(
      [0, 1, 2].map((group) =>
        prisma.retentionRun.create({
          data: { organizationId, entity: "members", startedAt: at(group), hasChanges: group !== 1 },
        })
      )
    );
    const itemsFor = (runId: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        runId,
        targetType: "user" as const,
        targetId: `user_${runId.slice(-4)}_${index}`,
        action: "notified" as const,
        recipient: `member${index}@example.test`,
      }));
    await prisma.retentionRunItem.createMany({ data: [...itemsFor(first.id, 3), ...itemsFor(third.id, 2)] });
    await prisma.retentionRun.create({ data: { organizationId: otherOrganizationId, entity: "members" } });

    const range = { organizationId, from: null, to: null };
    // Tiny batches, so both keyset walks cross several pages.
    const rows = [];
    for await (const row of iterateRetentionExportRows(range, { runBatchSize: 2, itemBatchSize: 2 })) {
      rows.push(row);
    }

    expect(rows.map((row) => [row.run.id, row.item?.targetId ?? null])).toEqual([
      [first.id, expect.any(String)],
      [first.id, expect.any(String)],
      [first.id, expect.any(String)],
      [second.id, null],
      [third.id, expect.any(String)],
      [third.id, expect.any(String)],
    ]);
    expect(new Set(rows.filter((row) => row.item).map((row) => row.item!.id)).size).toBe(5);
    expect(await countRetentionExportRows(range, 100)).toBe(6);
  });

  test("limits the export to the range: from inclusive, to exclusive", async () => {
    await Promise.all(
      [0, 1, 2].map((group) =>
        prisma.retentionRun.create({ data: { organizationId, entity: "responses", startedAt: at(group) } })
      )
    );

    const range = { organizationId, from: at(1), to: at(2) };
    const rows = [];
    for await (const row of iterateRetentionExportRows(range)) rows.push(row);

    expect(rows.map((row) => row.run.startedAt)).toEqual([at(1)]);
    expect(await countRetentionExportRows(range, 100)).toBe(1);
  });

  test("stops counting at the cap plus one, however many rows the range holds", async () => {
    await seedRuns(organizationId);

    expect(await countRetentionExportRows({ organizationId, from: null, to: null }, 5)).toBe(6);
  });
});
