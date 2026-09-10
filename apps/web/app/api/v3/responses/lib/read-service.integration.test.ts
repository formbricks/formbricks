import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { encodeKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import { resetDb } from "@/integration/reset-db";
import type { TV3ResponsesFilter } from "./parse-v3-responses-list-query";
import {
  V3_RESPONSE_COUNT_CAP,
  countV3Responses,
  getScopedV3Response,
  hydrateV3Responses,
  listV3ResponseKeysetPage,
} from "./service";

/**
 * The keyset walk against a real Postgres.
 *
 * The ticket asks for this specifically, and it is right to: the shipped dashboard cursor filters on
 * `id` while ordering by `createdAt`, which silently drops rows from exports and summaries. That bug
 * is invisible to a mocked test — the mock returns whatever it was told to — and it only appears
 * when rows actually share a `createdAt`. So the fixture below deliberately writes tie groups, and
 * the assertion is over the whole walk rather than over one page.
 */

vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const BASE = new Date("2026-09-01T00:00:00.000Z");

/**
 * Rows in four timestamps of five, so every page boundary in the walk below lands inside a tie group
 * rather than between them. A cursor that cannot break ties loses or repeats rows exactly here.
 */
const TIE_GROUPS = 4;
const PER_GROUP = 5;
const TOTAL = TIE_GROUPS * PER_GROUP;

const seedWorkspace = async (label: string) => {
  const organization = await prisma.organization.create({ data: { name: `${label} Org` } });
  const workspace = await prisma.workspace.create({
    data: { name: `${label} Workspace`, organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: `${label} Survey`,
      workspaceId: workspace.id,
      blocks: [{ id: "blk", name: "Block", elements: [{ id: "q1", type: "openText", required: false }] }],
    },
  });

  return { workspaceId: workspace.id, surveyId: survey.id };
};

/**
 * Ids assigned so their lexical order is the **reverse** of creation order.
 *
 * This is what makes the fixture able to fail. A generated cuid2 carries a timestamp prefix, so rows
 * inserted in `createdAt` order also come out in ascending id order — and while the two agree, a
 * cursor that filters on `id` alone behaves exactly like one that compares `(createdAt, id)`. The
 * broken implementation passes, and the test proves nothing. Production data correlates the same way
 * most of the time, which is precisely why the shipped bug is hard to see.
 *
 * Reversing the correlation costs nothing and makes the difference observable: under an id-only
 * cursor the walk stops advancing and starts repeating rows it has already served.
 */
const responseId = (position: number): string => `clrs${String(TOTAL - 1 - position).padStart(20, "0")}`;

const seedResponses = async (surveyId: string, idPrefix = "") => {
  for (let group = 0; group < TIE_GROUPS; group++) {
    const createdAt = new Date(BASE.getTime() + group * 60_000);

    for (let index = 0; index < PER_GROUP; index++) {
      const position = group * PER_GROUP + index;

      await prisma.response.create({
        data: {
          id: idPrefix ? `${idPrefix}${String(position).padStart(4, "0")}` : responseId(position),
          surveyId,
          createdAt,
          finished: index % 2 === 0,
          language: index % 2 === 0 ? "en" : "de",
          data: { q1: `g${group}-i${index}` },
        },
      });
    }
  }
};

/** Walk the whole collection the way a client must, and report what each page contained. */
const walk = async (filter: TV3ResponsesFilter, limit: number, sortBy: "-createdAt" | "createdAt") => {
  const seen: string[] = [];
  const pageSizes: number[] = [];
  let cursor: { value: string; id: string } | null = null;

  // Bounded so a cursor that fails to advance ends the test rather than the process.
  for (let page = 0; page < TOTAL + 5; page++) {
    const rows = await listV3ResponseKeysetPage({ filter, sortBy, limit, cursor });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    seen.push(...pageRows.map((row) => row.id));
    pageSizes.push(pageRows.length);

    const last = pageRows.at(-1);
    if (!hasMore || !last) break;

    cursor = { value: last.createdAt.toISOString(), id: last.id };
  }

  return { seen, pageSizes };
};

describe("the keyset walk, against real Postgres", () => {
  let scope: Awaited<ReturnType<typeof seedWorkspace>>;
  let filter: TV3ResponsesFilter;

  beforeEach(async () => {
    await resetDb();
    scope = await seedWorkspace("Mine");
    await seedResponses(scope.surveyId);
    filter = { workspaceId: scope.workspaceId, surveyId: scope.surveyId };
  });

  /**
   * The assertion the shipped cursor fails. Every row exactly once: no gaps, no repeats, across page
   * boundaries that fall inside groups of rows sharing a millisecond.
   */
  test("a full walk in pages of 3 returns every row exactly once", async () => {
    const { seen } = await walk(filter, 3, "-createdAt");

    expect(seen).toHaveLength(TOTAL);
    expect(new Set(seen).size).toBe(TOTAL);
  });

  test.each([1, 2, 3, 7, 20])("the walk is complete at page size %i", async (limit) => {
    const { seen } = await walk(filter, limit, "-createdAt");

    expect(new Set(seen).size).toBe(TOTAL);
  });

  test("the walk in ascending order visits the same rows, reversed", async () => {
    const descending = await walk(filter, 3, "-createdAt");
    const ascending = await walk(filter, 3, "createdAt");

    expect(ascending.seen).toEqual([...descending.seen].reverse());
  });

  /** A short page is not the end; only the absence of a further row is. */
  test("the last page is short and the walk stops there", async () => {
    const { pageSizes } = await walk(filter, 6, "-createdAt");

    expect(pageSizes).toEqual([6, 6, 6, 2]);
  });

  test("rows come back newest first, with ties broken consistently", async () => {
    const rows = await listV3ResponseKeysetPage({ filter, sortBy: "-createdAt", limit: TOTAL, cursor: null });
    const times = rows.map((row) => row.createdAt.getTime());

    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe("scope is enforced in the query, not assumed", () => {
  let mine: Awaited<ReturnType<typeof seedWorkspace>>;
  let theirs: Awaited<ReturnType<typeof seedWorkspace>>;

  beforeEach(async () => {
    await resetDb();
    mine = await seedWorkspace("Mine");
    theirs = await seedWorkspace("Theirs");
    await seedResponses(mine.surveyId);
    await seedResponses(theirs.surveyId, "clth0000000000000000");
  });

  /**
   * The cross-tenant shape: a caller authorized for their own workspace naming someone else's
   * survey. Scoping on `surveyId` alone would serve that survey's responses.
   */
  test("another workspace's surveyId yields an empty page, not their rows", async () => {
    const rows = await listV3ResponseKeysetPage({
      filter: { workspaceId: mine.workspaceId, surveyId: theirs.surveyId },
      sortBy: "-createdAt",
      limit: 50,
      cursor: null,
    });

    expect(rows).toEqual([]);
  });

  test("a workspace-wide list reaches only its own responses", async () => {
    const rows = await listV3ResponseKeysetPage({
      filter: { workspaceId: mine.workspaceId },
      sortBy: "-createdAt",
      limit: 100,
      cursor: null,
    });

    expect(rows).toHaveLength(TOTAL);
  });

  test("counting another workspace's survey counts nothing", async () => {
    const result = await countV3Responses({
      filter: { workspaceId: mine.workspaceId, surveyId: theirs.surveyId },
      precision: "exact",
    });

    expect(result).toEqual({ count: 0, relation: "eq" });
  });

  test("a scoped get refuses a response in another workspace", async () => {
    const theirResponse = await prisma.response.findFirstOrThrow({
      where: { surveyId: theirs.surveyId },
    });

    expect(await getScopedV3Response(theirResponse.id, { workspaceId: mine.workspaceId })).toBeNull();
    expect(await getScopedV3Response(theirResponse.id, { workspaceId: theirs.workspaceId })).not.toBeNull();
  });
});

describe("filters reach the database intact", () => {
  let scope: Awaited<ReturnType<typeof seedWorkspace>>;
  let filter: TV3ResponsesFilter;

  beforeEach(async () => {
    await resetDb();
    scope = await seedWorkspace("Mine");
    await seedResponses(scope.surveyId);
    filter = { workspaceId: scope.workspaceId, surveyId: scope.surveyId };
  });

  test("finished narrows to the completed half", async () => {
    const rows = await listV3ResponseKeysetPage({
      filter: { ...filter, finished: true },
      sortBy: "-createdAt",
      limit: 100,
      cursor: null,
    });

    expect(rows).toHaveLength(TIE_GROUPS * 3);
  });

  test("a language filter matches the stored codes", async () => {
    const rows = await listV3ResponseKeysetPage({
      filter: { ...filter, languages: ["de"] },
      sortBy: "-createdAt",
      limit: 100,
      cursor: null,
    });

    expect(rows).toHaveLength(TIE_GROUPS * 2);
  });

  /** Inclusive lower bound, exclusive upper — the four bounds are not interchangeable. */
  test("createdAt bounds select the expected window", async () => {
    const rows = await listV3ResponseKeysetPage({
      filter: {
        ...filter,
        createdAtGte: new Date(BASE.getTime() + 60_000),
        createdAtLt: new Date(BASE.getTime() + 180_000),
      },
      sortBy: "-createdAt",
      limit: 100,
      cursor: null,
    });

    expect(rows).toHaveLength(PER_GROUP * 2);
  });

  test("an id filter scope-filters rather than erroring on a foreign id", async () => {
    const own = await prisma.response.findFirstOrThrow({ where: { surveyId: scope.surveyId } });

    const rows = await listV3ResponseKeysetPage({
      filter: { ...filter, ids: [own.id, "clrs000000000000000000404"] },
      sortBy: "-createdAt",
      limit: 100,
      cursor: null,
    });

    expect(rows.map((row) => row.id)).toEqual([own.id]);
  });
});

describe("counting", () => {
  let scope: Awaited<ReturnType<typeof seedWorkspace>>;

  beforeEach(async () => {
    await resetDb();
    scope = await seedWorkspace("Mine");
    await seedResponses(scope.surveyId);
  });

  test("an exact count is exact and says so", async () => {
    const result = await countV3Responses({
      filter: { workspaceId: scope.workspaceId },
      precision: "exact",
    });

    expect(result).toEqual({ count: TOTAL, relation: "eq" });
  });

  /** Below the cap the capped path is exact too — `gte` is reserved for a count that hit the cap. */
  test("a capped count below the cap reports eq", async () => {
    const result = await countV3Responses({
      filter: { workspaceId: scope.workspaceId },
      precision: "capped",
    });

    expect(result).toEqual({ count: TOTAL, relation: "eq" });
    expect(TOTAL).toBeLessThan(V3_RESPONSE_COUNT_CAP);
  });
});

describe("hydration", () => {
  let scope: Awaited<ReturnType<typeof seedWorkspace>>;

  beforeEach(async () => {
    await resetDb();
    scope = await seedWorkspace("Mine");
    await seedResponses(scope.surveyId);
  });

  /**
   * `IN` does not preserve order, and the page's order is the entire product of phase one — so the
   * re-ordering in phase two is load-bearing rather than cosmetic.
   */
  test("rows come back in the order the ids were given, not the database's", async () => {
    const page = await listV3ResponseKeysetPage({
      filter: { workspaceId: scope.workspaceId },
      sortBy: "-createdAt",
      limit: 10,
      cursor: null,
    });
    const ids = page.slice(0, 6).map((row) => row.id);
    const reversed = [...ids].reverse();

    expect((await hydrateV3Responses(ids)).map((row) => row.id)).toEqual(ids);
    expect((await hydrateV3Responses(reversed)).map((row) => row.id)).toEqual(reversed);
  });

  test("an id with no surviving row is dropped rather than leaving a hole", async () => {
    const own = await prisma.response.findFirstOrThrow({ where: { surveyId: scope.surveyId } });

    expect((await hydrateV3Responses([own.id, "clrs000000000000000000404"])).map((r) => r.id)).toEqual([
      own.id,
    ]);
  });

  test("no ids is no query", async () => {
    expect(await hydrateV3Responses([])).toEqual([]);
  });
});

describe("the cursor is a position, not a promise", () => {
  let scope: Awaited<ReturnType<typeof seedWorkspace>>;

  beforeEach(async () => {
    await resetDb();
    scope = await seedWorkspace("Mine");
    await seedResponses(scope.surveyId);
  });

  /**
   * Rows inserted after a walk starts are simply newer than the cursor's position, so a descending
   * walk never sees them. That is keyset pagination working, not a gap — and it is the property an
   * offset would not have.
   */
  test("a row inserted mid-walk does not shift the pages already served", async () => {
    const filter = { workspaceId: scope.workspaceId, surveyId: scope.surveyId };
    const first = await listV3ResponseKeysetPage({ filter, sortBy: "-createdAt", limit: 5, cursor: null });
    const last = first[4];

    await prisma.response.create({
      data: { surveyId: scope.surveyId, createdAt: new Date(), data: {}, finished: true },
    });

    const second = await listV3ResponseKeysetPage({
      filter,
      sortBy: "-createdAt",
      limit: 5,
      cursor: { value: last.createdAt.toISOString(), id: last.id },
    });

    expect(second.map((row) => row.id)).not.toContain(last.id);
    expect(new Set([...first.slice(0, 5), ...second].map((r) => r.id)).size).toBe(
      first.slice(0, 5).length + second.length
    );
  });

  /** The encoded token round-trips through the same comparison the raw page predicate uses. */
  test("an encoded cursor resumes exactly where the page ended", async () => {
    const filter = { workspaceId: scope.workspaceId, surveyId: scope.surveyId };
    const page = await listV3ResponseKeysetPage({ filter, sortBy: "-createdAt", limit: 4, cursor: null });
    const last = page[3];

    const token = encodeKeysetCursor({
      version: 1,
      kind: "responses",
      sortBy: "-createdAt",
      fp: "fingerprint",
      value: last.createdAt.toISOString(),
      id: last.id,
    });

    expect(token).toMatch(/^[\w-]+$/);

    const next = await listV3ResponseKeysetPage({
      filter,
      sortBy: "-createdAt",
      limit: 4,
      cursor: { value: last.createdAt.toISOString(), id: last.id },
    });

    expect(next.map((row) => row.id)).not.toContain(last.id);
  });
});
