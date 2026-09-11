import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { type TResponseFilterCriteria } from "@formbricks/types/responses";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { buildWhereClause } from "@/lib/response/where-clause";

/**
 * The "Other" response filter against real Postgres (ENG-3161).
 *
 * The unit suite mocks `@formbricks/database`, so it can only assert the *shape* of the filter
 * object — it would pass just as happily with a predicate that selects the wrong rows. Only a real
 * database shows that the numeric JSON path segments this branch emits actually index into the
 * stored array, and that the rows the old permutation set existed to handle (a different answer
 * order, a duplicated label) still come back the same way.
 *
 * The fixture is deliberately 12 choices across 2 languages: 24 predefined labels, where the
 * previous implementation aborted the Node process at 11.
 */

const LANGUAGES = ["default", "de"] as const;
const CHOICE_COUNT = 12;

/** Label of choice `index` in `language` — "A0".."A11" in English, "D0".."D11" in German. */
const label = (language: (typeof LANGUAGES)[number], index: number): string =>
  `${language === "default" ? "A" : "D"}${index}`;

const MULTI_ID = "qMulti";
const SINGLE_ID = "qSingle";

const BLOCKS = [
  {
    id: "clbk1234567890123456789013",
    name: "Main Block",
    elements: [
      {
        id: MULTI_ID,
        type: "multipleChoiceMulti",
        headline: { default: "Pick many" },
        required: false,
        shuffleOption: "none",
        choices: [
          ...Array.from({ length: CHOICE_COUNT }, (_unused, index) => ({
            id: `c${index}`,
            label: Object.fromEntries(LANGUAGES.map((language) => [language, label(language, index)])),
          })),
          { id: "other", label: { default: "Other" } },
        ],
      },
      {
        id: SINGLE_ID,
        type: "multipleChoiceSingle",
        headline: { default: "Pick one" },
        required: false,
        shuffleOption: "none",
        choices: [
          { id: "s0", label: { default: "S0" } },
          { id: "s1", label: { default: "S1" } },
          { id: "other", label: { default: "Other" } },
        ],
      },
    ],
  },
];

/** The survey as `buildWhereClause` reads it — it only ever touches `blocks`. */
const survey = { id: "unused", blocks: BLOCKS } as unknown as TSurvey;

/** Each case seeds one response and is asserted by name, so a failure says which shape broke. */
const CASES: { name: string; data: Record<string, unknown> }[] = [
  { name: "one predefined label", data: { [MULTI_ID]: ["A0"] } },
  { name: "two predefined labels", data: { [MULTI_ID]: ["A0", "A1"] } },
  { name: "predefined + write-in", data: { [MULTI_ID]: ["A0", "my own answer"] } },
  { name: "write-in only", data: { [MULTI_ID]: ["my own answer"] } },
  { name: "empty array", data: { [MULTI_ID]: [] } },
  { name: "key absent", data: {} },
  { name: "json null", data: { [MULTI_ID]: null } },
  { name: "reversed order", data: { [MULTI_ID]: ["A1", "A0"] } },
  { name: "duplicated label", data: { [MULTI_ID]: ["A0", "A0"] } },
  { name: "german label + write-in", data: { [MULTI_ID]: ["D0", "my own answer"] } },
  { name: "german labels only", data: { [MULTI_ID]: ["D0", "D1"] } },
  { name: "single: predefined", data: { [SINGLE_ID]: "S0" } },
  { name: "single: write-in", data: { [SINGLE_ID]: "typed" } },
  { name: "single: empty string", data: { [SINGLE_ID]: "" } },
];

let surveyId: string;
/** Response id per case name, so assertions read as sets of names rather than cuids. */
let idsByName: Map<string, string>;

const seed = async (): Promise<void> => {
  const organization = await prisma.organization.create({ data: { name: "Filter Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Filter Workspace", organizationId: organization.id },
  });
  const created = await prisma.survey.create({
    data: {
      name: "Filter Survey",
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      blocks: BLOCKS,
    },
    select: { id: true },
  });
  surveyId = created.id;

  idsByName = new Map();
  for (const testCase of CASES) {
    const response = await prisma.response.create({
      // `json null` stores a JSON null inside the object, which TResponseData does not model.
      data: { surveyId, finished: true, data: testCase.data as never },
      select: { id: true },
    });
    idsByName.set(testCase.name, response.id);
  }
};

/** Names of the responses the filter selects, sorted so assertions are order-independent. */
const matchingNames = async (filterCriteria: TResponseFilterCriteria): Promise<string[]> => {
  const where = { surveyId, ...buildWhereClause(survey, filterCriteria) };
  const rows = await prisma.response.findMany({ where, select: { id: true } });

  // The count path runs the same predicate through a different Prisma call; they must agree.
  const count = await prisma.response.count({ where });
  expect(count).toBe(rows.length);

  const nameById = new Map([...idsByName].map(([name, id]) => [id, name]));
  return rows.map((row) => nameById.get(row.id) ?? row.id).sort((a, b) => a.localeCompare(b));
};

const otherFilter = (elementId: string, values: string[]): TResponseFilterCriteria => ({
  data: { [elementId]: { op: "includesOne", value: values } },
});

beforeEach(async () => {
  await resetDb();
  await seed();
});

describe('multipleChoiceMulti filtered by "Other"', () => {
  test("selects exactly the responses carrying a value outside the predefined set", async () => {
    expect(await matchingNames(otherFilter(MULTI_ID, ["Other"]))).toEqual([
      "german label + write-in",
      "predefined + write-in",
      "write-in only",
    ]);
  });

  test("a different answer order or a duplicated label is still not an Other", async () => {
    // These two are the whole reason the old implementation enumerated permutations. Ordering and
    // duplication must stay invisible to the predicate.
    const matched = await matchingNames(otherFilter(MULTI_ID, ["Other"]));

    expect(matched).not.toContain("reversed order");
    expect(matched).not.toContain("duplicated label");
  });

  test("an unanswered, empty or json-null response does not match", async () => {
    // Previously these matched: the empty subset was skipped, so `NOT { OR: [...] }` let them
    // through. Fixing that is a deliberate, user-visible change to filter counts.
    const matched = await matchingNames(otherFilter(MULTI_ID, ["Other"]));

    expect(matched).not.toContain("empty array");
    expect(matched).not.toContain("key absent");
    expect(matched).not.toContain("json null");
  });

  test("selecting Other alongside a predefined label also returns that label's responses", async () => {
    // "A0" is now a selected value, so it drops out of predefinedLabels and any entry holding it
    // counts as "outside the predefined set".
    expect(await matchingNames(otherFilter(MULTI_ID, ["Other", "A0"]))).toEqual([
      "duplicated label",
      "german label + write-in",
      "one predefined label",
      "predefined + write-in",
      "reversed order",
      "two predefined labels",
      "write-in only",
    ]);
  });
});

describe('multipleChoiceSingle filtered by "Other"', () => {
  test("selects the write-in and leaves predefined answers behind", async () => {
    const matched = await matchingNames(otherFilter(SINGLE_ID, ["Other"]));

    expect(matched).toContain("single: write-in");
    expect(matched).not.toContain("single: predefined");
    // An "Other" ticked but left blank stores "", which is not a predefined label and so still
    // counts as Other — unchanged by ENG-3161, and consistent with how the multi branch treats it.
    expect(matched).toContain("single: empty string");
  });

  test("a response that never answered the question does not match", async () => {
    const matched = await matchingNames(otherFilter(SINGLE_ID, ["Other"]));

    expect(matched).not.toContain("key absent");
  });
});
