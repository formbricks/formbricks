import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { type TEmbeddedValueResponse } from "@formbricks/types/embedded-data-resolver";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { type TResponseFilteringValues, getSurveyFilteringValues } from "@/lib/response/filtering-values";
import {
  getResponseContactAttributes,
  getResponseHiddenFields,
  getResponseMeta,
  getResponseReservedFilterValues,
  getResponseVariableFilterValues,
} from "@/lib/response/utils";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * The response filter's option lists against real Postgres (ENG-3755).
 *
 * The unit suite mocks `$queryRaw`, so it can only check how rows are mapped. Whether the jsonb SQL
 * (`jsonb_each`, the nested/array branch, the `url` cut, the `data -> key` reads) returns the values
 * the old path saw is something only Postgres answers. The reference here is the path it replaced:
 * every full row through `findMany`, then the same helpers.
 */

const BLOCKS = [
  {
    id: "clbk1234567890123456789013",
    name: "Main Block",
    elements: [
      {
        id: "q1",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

/** A survey with two ingested fields (`campaign` text, `score` number) and a text variable `plan`. */
const seedSurvey = async (name: string): Promise<TSurvey> => {
  const organization = await prisma.organization.create({ data: { name: `${name} Org` } });
  const workspace = await prisma.workspace.create({
    data: { name: `${name} Workspace`, organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name, type: "link", status: "inProgress", workspaceId: workspace.id, blocks: BLOCKS },
    select: { id: true },
  });
  const fields = [
    { name: "Campaign", source: "ingested", dataType: "string", storageKey: "campaign" },
    { name: "Score", source: "ingested", dataType: "number", storageKey: "score" },
    { name: "Plan", source: "computed", dataType: "string", storageKey: "plan" },
  ] as const;
  for (const [order, { storageKey, ...field }] of fields.entries()) {
    const row = await prisma.embeddedData.create({
      data: { ...field, workspaceId: workspace.id, surveyId: survey.id },
    });
    await prisma.surveyEmbeddedData.create({
      data: { workspaceId: workspace.id, surveyId: survey.id, embeddedDataId: row.id, storageKey, order },
    });
  }

  const row = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id }, select: selectSurvey });
  return transformPrismaSurvey<TSurvey>(row);
};

type TResponseSeed = Pick<
  Parameters<typeof prisma.response.create>[0]["data"],
  "meta" | "data" | "variables" | "contactAttributes"
>;

const seedResponses = async (survey: TSurvey, responses: TResponseSeed[]): Promise<void> => {
  for (const response of responses) {
    await prisma.response.create({ data: { surveyId: survey.id, finished: true, ...response } });
  }
};

/** The implementation ENG-3755 replaced: every full row, then the helpers. */
const readEveryResponse = async (survey: TSurvey) => {
  const responses = await prisma.response.findMany({
    where: { surveyId: survey.id },
    select: {
      id: true,
      surveyId: true,
      createdAt: true,
      updatedAt: true,
      finished: true,
      language: true,
      data: true,
      variables: true,
      ttc: true,
      meta: true,
      contactAttributes: true,
    },
  });
  const rows = responses as unknown as (TEmbeddedValueResponse &
    Parameters<typeof getResponseMeta>[0][number])[];
  return {
    contactAttributes: getResponseContactAttributes(rows),
    meta: getResponseMeta(rows),
    hiddenFields: getResponseHiddenFields(survey, rows),
    reservedValues: getResponseReservedFilterValues(survey, rows),
    variableValues: getResponseVariableFilterValues(survey, rows),
  };
};

/** Option order is not part of the contract: compare each list as a set. */
const asSets = (values: TResponseFilteringValues) =>
  Object.fromEntries(
    Object.entries(values).map(([group, lists]: [string, Record<string, string[]>]) => [
      group,
      Object.fromEntries(
        Object.entries(lists)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, list]) => [key, [...new Set(list)].sort((a, b) => a.localeCompare(b))])
      ),
    ])
  );

beforeEach(async () => {
  await resetDb();
});

describe("getSurveyFilteringValues (real Postgres)", () => {
  test("returns what reading every response returned, and nothing from another survey", async () => {
    const survey = await seedSurvey("Filtered");
    const other = await seedSurvey("Other");

    await seedResponses(survey, [
      {
        meta: {
          source: "link",
          url: "https://app.test/s/abc?suToken=secret-1#frag",
          pageReferrer: "https://ref.test/landing?email=a@x.test",
          userAgent: { browser: "Chrome", os: "Mac OS", device: "desktop" },
          country: "DE",
          screenWidth: 1280,
          utmSource: "newsletter",
        },
        data: { q1: "a private answer", campaign: "spring", score: 7 },
        variables: { plan: "gold" },
        contactAttributes: { email: "a@x.test", plan: "pro" },
      },
      {
        meta: {
          url: "https://app.test/s/abc?suToken=secret-2",
          pageReferrer: "https://ref.test/landing?email=b@x.test",
          // An array where an object is expected: the old walk read it by index.
          userAgent: ["Firefox", "Linux"],
          country: "",
        },
        data: { campaign: "", score: 0 },
        variables: { plan: "silver" },
        contactAttributes: { email: "b@x.test" },
      },
      {
        meta: { url: "https://app.test/other#only-hash", userAgent: { browser: "Safari" } },
        data: { campaign: "summer", score: 42.5 },
        variables: { plan: "" },
        contactAttributes: null,
      },
      { meta: {}, data: {}, variables: {}, contactAttributes: null },
    ]);
    await seedResponses(other, [
      {
        meta: {
          source: "leak-source",
          url: "https://leak.test/p?x=1",
          pageReferrer: "https://leak.test/ref",
          userAgent: { browser: "LeakBrowser" },
        },
        data: { campaign: "leak-campaign", score: 999 },
        variables: { plan: "leak-plan" },
        contactAttributes: { email: "leak@x.test", leakKey: "leak" },
      },
    ]);

    const values = await getSurveyFilteringValues(survey);

    expect(asSets(values)).toEqual(asSets(await readEveryResponse(survey)));
    // Not vacuous: the seeded shapes reached each list.
    expect(values.reservedValues.url?.sort()).toEqual(["https://app.test/other", "https://app.test/s/abc"]);
    expect(values.reservedValues.pageReferrer).toEqual(["https://ref.test/landing"]);
    expect(values.meta["0"]).toEqual(["Firefox"]);
    expect(values.hiddenFields.score?.sort()).toEqual(["0", "42.5", "7"]);
    expect(JSON.stringify(values)).not.toContain("secret");
    expect(JSON.stringify(values)).not.toContain("private answer");
    // Scoped to the survey: nothing the other survey's responses hold.
    expect(JSON.stringify(values)).not.toMatch(/leak|999/);
  });

  test("a jsonb null contact attribute is skipped instead of failing the load", async () => {
    const survey = await seedSurvey("Null attribute");
    await seedResponses(survey, [{ contactAttributes: { email: null, plan: "pro" } }]);

    const { contactAttributes } = await getSurveyFilteringValues(survey);

    expect(contactAttributes).toEqual({ plan: ["pro"] });
  });
});
