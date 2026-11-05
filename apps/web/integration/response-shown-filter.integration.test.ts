import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TResponseFilterCriteriaShown } from "@formbricks/types/responses";
import type { TResponseNotShown } from "@formbricks/types/surveys/not-shown";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { OptionsType } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/response-filter-options";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { resetDb } from "@/integration/reset-db";
import { buildWhereClause } from "@/lib/response/where-clause";

/**
 * Shown / not shown filters (ENG-6951) against real Postgres: each target kind, both operators, over
 * one set of responses that covers every way a record can read. What a jsonb containment answers on a
 * missing key (SQL NULL, which no NOT turns into a match) is a question only Postgres settles.
 */

const { heavyUsers, overall } = SURVEY_FLOW_FIXTURE_IDS.blocks;

/** Every element the "reached it all" responses answered or submitted. */
const REACHED_ELEMENTS = ["services", "hours", "fav", "apple_reason", "brand_grid"];

type TSeed = {
  notShown: TResponseNotShown | null;
  data?: Record<string, unknown>;
  ttc?: Record<string, number>;
};

/**
 * The responses, by what they stand for:
 * - `legacy`: no record (before 6.2). Answered everything, yet unknown to both operators.
 * - `hidden`: the record keeps a block, a question, an option, a row and a column from them.
 * - `answered`: an empty record, every element answered.
 * - `skipped`: an empty record, every element submitted blank (time entries only).
 * - `leftEarly`: an empty record, left after the first page: never reached the rest.
 * - `questionHidden`: the record lists `fav` and `brand_grid` themselves, not their options.
 */
const SEEDS = {
  legacy: {
    notShown: null,
    data: { services: ["Netflix"], hours: "10", fav: "Netflix", apple_reason: "x", brand_grid: {} },
    ttc: Object.fromEntries(REACHED_ELEMENTS.map((id) => [id, 1000])),
  },
  hidden: {
    notShown: {
      blocks: [heavyUsers],
      elements: ["apple_reason"],
      options: { fav: ["apple"] },
      rows: { brand_grid: ["row_disney"] },
      columns: { brand_grid: ["col_good"] },
    },
    data: { services: ["Netflix"], fav: "Netflix", brand_grid: { Netflix: "Poor" } },
    ttc: { services: 1000, fav: 1000, brand_grid: 1000 },
  },
  answered: {
    notShown: {},
    data: {
      services: ["Netflix", "Apple TV+"],
      hours: "10",
      fav: "Apple TV+",
      apple_reason: "Originals",
      brand_grid: { Netflix: "Good" },
    },
    ttc: Object.fromEntries(REACHED_ELEMENTS.map((id) => [id, 1000])),
  },
  skipped: {
    notShown: {},
    data: { services: ["Netflix"] },
    ttc: Object.fromEntries(REACHED_ELEMENTS.map((id) => [id, 0])),
  },
  leftEarly: {
    notShown: {},
    data: { services: ["Netflix"] },
    ttc: { services: 1000 },
  },
  questionHidden: {
    notShown: { elements: ["fav", "brand_grid"] },
    data: { services: ["Netflix"], hours: "10", apple_reason: "x" },
    ttc: { services: 1000, hours: 1000, apple_reason: 1000 },
  },
} satisfies Record<string, TSeed>;

type TSeedName = keyof typeof SEEDS;

let survey: TSurvey;
const responseIds = {} as Record<TSeedName, string>;

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "ACME Inc." } });
  const workspace = await prisma.workspace.create({
    data: { name: "Retail Banking", organizationId: organization.id },
  });
  const created = await prisma.survey.create({
    data: {
      name: surveyFlowFixture.name,
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      blocks: surveyFlowFixture.blocks,
    },
    select: { id: true },
  });
  survey = { ...surveyFlowFixture, id: created.id, workspaceId: workspace.id };

  for (const [name, seed] of Object.entries(SEEDS) as [TSeedName, TSeed][]) {
    const response = await prisma.response.create({
      data: {
        surveyId: created.id,
        finished: false,
        data: (seed.data ?? {}) as Prisma.InputJsonValue,
        ttc: (seed.ttc ?? {}) as Prisma.InputJsonValue,
        notShown: seed.notShown === null ? Prisma.DbNull : (seed.notShown as Prisma.InputJsonValue),
      },
      select: { id: true },
    });
    responseIds[name] = response.id;
  }
});

/** The seeds a `shown` criteria list matches, by name, sorted. */
const matching = async (shown: TResponseFilterCriteriaShown[]): Promise<TSeedName[]> => {
  const rows = await prisma.response.findMany({
    where: { surveyId: survey.id, ...buildWhereClause(survey, { shown }) },
    select: { id: true },
  });
  const names = Object.entries(responseIds)
    .filter(([, id]) => rows.some((row) => row.id === id))
    .map(([name]) => name as TSeedName);
  return names.sort((a, b) => a.localeCompare(b));
};

describe("shown / not shown filters (real Postgres)", () => {
  test("a block: not shown when the record lists it; shown when one of its elements was reached", async () => {
    expect(await matching([{ target: "block", blockId: heavyUsers, op: "notShown" }])).toEqual(["hidden"]);
    expect(await matching([{ target: "block", blockId: heavyUsers, op: "shown" }])).toEqual([
      "answered",
      "questionHidden",
      "skipped",
    ]);
  });

  test("a block with a hidden element is still shown when another element on it was reached", async () => {
    // `hidden` lists apple_reason, but fav on the same block was answered.
    expect(await matching([{ target: "block", blockId: overall, op: "shown" }])).toEqual([
      "answered",
      "hidden",
      "questionHidden",
      "skipped",
    ]);
    expect(await matching([{ target: "block", blockId: overall, op: "notShown" }])).toEqual([]);
  });

  test("a question: not shown when it or its block is listed; shown when reached and not listed", async () => {
    expect(await matching([{ target: "element", elementId: "apple_reason", op: "notShown" }])).toEqual([
      "hidden",
    ]);
    expect(await matching([{ target: "element", elementId: "apple_reason", op: "shown" }])).toEqual([
      "answered",
      "questionHidden",
      "skipped",
    ]);
    // `hours` sits on the block `hidden` passed over: not shown through its block.
    expect(await matching([{ target: "element", elementId: "hours", op: "notShown" }])).toEqual(["hidden"]);
  });

  test("an option: not shown when listed for its question, or when the question itself was not shown", async () => {
    const option = { target: "option", elementId: "fav", itemId: "apple" } as const;
    expect(await matching([{ ...option, op: "notShown" }])).toEqual(["hidden", "questionHidden"]);
    expect(await matching([{ ...option, op: "shown" }])).toEqual(["answered", "skipped"]);
    // Another option of the same question was shown to `hidden`, which answered it.
    expect(await matching([{ target: "option", elementId: "fav", itemId: "netflix", op: "shown" }])).toEqual([
      "answered",
      "hidden",
      "skipped",
    ]);
  });

  test("a matrix row", async () => {
    const row = { target: "row", elementId: "brand_grid", itemId: "row_disney" } as const;
    expect(await matching([{ ...row, op: "notShown" }])).toEqual(["hidden", "questionHidden"]);
    expect(await matching([{ ...row, op: "shown" }])).toEqual(["answered", "skipped"]);
  });

  test("a matrix column", async () => {
    const column = { target: "column", elementId: "brand_grid", itemId: "col_good" } as const;
    expect(await matching([{ ...column, op: "notShown" }])).toEqual(["hidden", "questionHidden"]);
    expect(await matching([{ ...column, op: "shown" }])).toEqual(["answered", "skipped"]);
    expect(
      await matching([{ target: "column", elementId: "brand_grid", itemId: "col_poor", op: "shown" }])
    ).toEqual(["answered", "hidden", "skipped"]);
  });

  test("conditions AND together", async () => {
    expect(
      await matching([
        { target: "element", elementId: "hours", op: "shown" },
        { target: "option", elementId: "fav", itemId: "apple", op: "notShown" },
      ])
    ).toEqual(["questionHidden"]);
  });

  test("a target the survey does not hold adds no condition", async () => {
    const all = await matching([]);
    expect(await matching([{ target: "element", elementId: "no_such_question", op: "shown" }])).toEqual(all);
    expect(
      await matching([{ target: "row", elementId: "fav", itemId: "apple", op: "notShown" }]) // fav has no rows
    ).toEqual(all);
  });

  test("the Responses filter row reaches the query through getFormattedFilters", async () => {
    const criteria = getFormattedFilters(
      survey,
      {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: OptionsType.SHOWN, id: "shown.option.fav.apple", label: "fav · Apple TV+" },
            filterType: { filterValue: "is", filterComboBoxValue: "notShown" },
            shownTarget: { target: "option", elementId: "fav", itemId: "apple" },
          },
        ],
      },
      { from: undefined, to: undefined }
    );
    const rows = await prisma.response.findMany({
      where: { surveyId: survey.id, ...buildWhereClause(survey, criteria) },
      select: { id: true },
    });
    expect(rows.map((row) => row.id).sort((a, b) => a.localeCompare(b))).toEqual(
      [responseIds.hidden, responseIds.questionHidden].sort((a, b) => a.localeCompare(b))
    );
  });
});
