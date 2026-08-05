import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  TBaseFilters,
  TSegmentConnector,
  TSurveyInteractionOperator,
  TSurveyInteractionTimeUnit,
} from "@formbricks/types/segment";
import { segmentFilterToPrismaQuery } from "./prisma-query";
import {
  type TContactInteractionData,
  tryEvaluateSurveyInteractionSegmentInMemory,
} from "./survey-interaction";

// The two evaluation paths (in-memory hot path vs Prisma dashboard/preview) MUST return identical
// membership for the same segment — that is the core invariant of the feature. Unit tests elsewhere
// check each path in isolation; this suite feeds the SAME fixtures through BOTH and asserts they agree,
// including for mixed AND/OR connectors (the precedence bug fixed alongside this test).

vi.mock("@formbricks/database", () => ({
  prisma: {},
}));
vi.mock("../segments", () => ({ getSegment: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));

const WORKSPACE_ID = "workspace-parity";
const SEGMENT_ID = "segment-parity";
// Anchor to the real clock: the Prisma builder computes its window from `new Date()` internally, so the
// in-memory `now` must be the same instant (within ms) for the two paths to agree. Fixtures sit days
// away from every window edge, so the sub-second difference is irrelevant.
const NOW = new Date();

const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

// ---- Minimal interpreter for the ContactWhereInput subset our builders emit -------------------------

interface FixtureContact {
  displays: { surveyId: string; createdAt: Date }[];
  responses: { surveyId: string; createdAt: Date; finished: boolean }[];
}

type SomeClause = {
  surveyId?: { in: string[] };
  finished?: boolean;
  createdAt: { gte: Date };
};

const rowMatchesSome = (
  row: { surveyId: string; createdAt: Date; finished?: boolean },
  some: SomeClause
): boolean => {
  if (row.createdAt < some.createdAt.gte) return false;
  if (some.surveyId && !some.surveyId.in.includes(row.surveyId)) return false;
  if (some.finished !== undefined && row.finished !== some.finished) return false;
  return true;
};

/** Evaluates the (interaction-only) Prisma where clause against an in-memory fixture contact. */
const evalPrismaClause = (contact: FixtureContact, clause: Record<string, any>): boolean => {
  if (!clause || Object.keys(clause).length === 0) return true; // match-all
  if (Array.isArray(clause.AND)) return clause.AND.every((c: any) => evalPrismaClause(contact, c));
  if (Array.isArray(clause.OR)) return clause.OR.some((c: any) => evalPrismaClause(contact, c));
  if (clause.NOT) return !evalPrismaClause(contact, clause.NOT);
  if (clause.displays?.some) return contact.displays.some((d) => rowMatchesSome(d, clause.displays.some));
  if (clause.responses?.some) return contact.responses.some((r) => rowMatchesSome(r, clause.responses.some));
  throw new Error(`Unhandled clause in parity interpreter: ${JSON.stringify(clause)}`);
};

const prismaMembership = async (contact: FixtureContact, filters: TBaseFilters): Promise<boolean> => {
  const result = await segmentFilterToPrismaQuery(SEGMENT_ID, filters, WORKSPACE_ID);
  if (!result.ok) throw new Error("segmentFilterToPrismaQuery failed");
  // The outer clause is { AND: [{ workspaceId }, filtersClause] }; fixtures are in-workspace, so we
  // evaluate only the filters clause.
  const filtersClause = result.data.whereClause.AND[1] as Record<string, any>;
  return evalPrismaClause(contact, filtersClause);
};

const inMemoryMembership = (contact: FixtureContact, filters: TBaseFilters): boolean => {
  const data: TContactInteractionData = { displays: contact.displays, responses: contact.responses };
  const result = tryEvaluateSurveyInteractionSegmentInMemory(filters, data, NOW);
  if (result === null) throw new Error("expected an interaction-only segment");
  return result;
};

// ---- Filter builders --------------------------------------------------------------------------------

let filterSeq = 0;
const interactionFilter = (
  operator: TSurveyInteractionOperator,
  opts: {
    scope?: "any" | "specific";
    surveyIds?: string[];
    amount?: number;
    unit?: TSurveyInteractionTimeUnit;
    connector?: TSegmentConnector;
  } = {}
) => {
  filterSeq += 1;
  return {
    id: `f_${filterSeq}`,
    connector: opts.connector ?? null,
    resource: {
      id: `r_${filterSeq}`,
      root: { type: "surveyInteraction" as const },
      qualifier: { operator },
      value: {
        surveyScope: opts.scope ?? "any",
        surveyIds: opts.surveyIds ?? [],
        within: { amount: opts.amount ?? 1, unit: opts.unit ?? ("months" as const) },
      },
    },
  };
};

// ---- Fixtures: a spread of contacts with recent/old, finished/unfinished, in/out-of-scope rows -------

const A = "srv0000000000000000000a";
const B = "srv0000000000000000000b";
const C = "srv0000000000000000000c";

const contacts: Record<string, FixtureContact> = {
  none: { displays: [], responses: [] },
  seenARecent: { displays: [{ surveyId: A, createdAt: daysAgo(5) }], responses: [] },
  seenAOld: { displays: [{ surveyId: A, createdAt: daysAgo(400) }], responses: [] },
  startedBRecent: { displays: [], responses: [{ surveyId: B, createdAt: daysAgo(5), finished: false }] },
  completedCRecent: { displays: [], responses: [{ surveyId: C, createdAt: daysAgo(5), finished: true }] },
  mixed: {
    displays: [
      { surveyId: A, createdAt: daysAgo(5) },
      { surveyId: B, createdAt: daysAgo(400) },
    ],
    responses: [
      { surveyId: B, createdAt: daysAgo(2), finished: false },
      { surveyId: C, createdAt: daysAgo(2), finished: true },
    ],
  },
};

const OPERATORS: TSurveyInteractionOperator[] = [
  "haveSeen",
  "haveNotSeen",
  "haveStartedRespondingTo",
  "haveCompleted",
  "haveNotCompleted",
];

describe("survey-interaction eval-path parity (in-memory vs Prisma)", () => {
  beforeEach(() => {
    filterSeq = 0;
  });

  test.each(OPERATORS)("single filter, any scope — %s agrees across paths", async (operator) => {
    const filters = [interactionFilter(operator)] as unknown as TBaseFilters;
    for (const [name, contact] of Object.entries(contacts)) {
      const inMem = inMemoryMembership(contact, filters);
      const db = await prismaMembership(contact, filters);
      expect(`${name}:${inMem}`).toBe(`${name}:${db}`);
    }
  });

  test.each(OPERATORS)("single filter, specific scope [A,C] — %s agrees across paths", async (operator) => {
    const filters = [
      interactionFilter(operator, { scope: "specific", surveyIds: [A, C] }),
    ] as unknown as TBaseFilters;
    for (const [name, contact] of Object.entries(contacts)) {
      const inMem = inMemoryMembership(contact, filters);
      const db = await prismaMembership(contact, filters);
      expect(`${name}:${inMem}`).toBe(`${name}:${db}`);
    }
  });

  test("mixed AND/OR connectors agree across paths (precedence parity)", async () => {
    // (haveSeen A) AND (haveCompleted C) OR (haveStartedRespondingTo B)
    // = (A∧C) ∨ B — the group boundary is the `or` connector, matching combineFilterResults.
    const filters = [
      interactionFilter("haveSeen", { scope: "specific", surveyIds: [A] }),
      interactionFilter("haveCompleted", { scope: "specific", surveyIds: [C], connector: "and" }),
      interactionFilter("haveStartedRespondingTo", { scope: "specific", surveyIds: [B], connector: "or" }),
    ] as unknown as TBaseFilters;

    for (const [name, contact] of Object.entries(contacts)) {
      const inMem = inMemoryMembership(contact, filters);
      const db = await prismaMembership(contact, filters);
      expect(`${name}:${inMem}`).toBe(`${name}:${db}`);
    }
  });

  test("negation with only out-of-window interactions matches in both paths", async () => {
    // seenAOld saw A 400 days ago; within 1 month they have NOT seen it recently.
    const filters = [
      interactionFilter("haveNotSeen", { scope: "specific", surveyIds: [A], amount: 1, unit: "months" }),
    ] as unknown as TBaseFilters;

    const inMem = inMemoryMembership(contacts.seenAOld, filters);
    const db = await prismaMembership(contacts.seenAOld, filters);
    expect(inMem).toBe(true);
    expect(db).toBe(true);
    expect(inMem).toBe(db);
  });
});
