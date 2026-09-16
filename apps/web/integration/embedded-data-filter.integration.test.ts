import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { type TResponseFilterCriteria } from "@formbricks/types/responses";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { resetDb } from "@/integration/reset-db";
import { applyIngestContractToResponseData } from "@/lib/response/ingest";
import { buildWhereClause } from "@/lib/response/where-clause";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * Filtering an ingested Embedded Data field against real Postgres (ENG-3231).
 *
 * The bug this exists to keep out was invisible to both unit suites, because each one was internally
 * consistent: ingest stores the string `"true"` (there is no boolean member in `ZResponseDataValue`),
 * the filter built a real jsonb boolean, and no test ran one against the other. A jsonb `=` between
 * `"true"` and `true` is false, so `is_pro equals true` returned nothing the moment a boolean field
 * held a value — and only a real column can show that, since the unit harness mocks Prisma away and
 * would have happily "matched" either shape.
 *
 * So the journey here is the whole width of the ticket in one row: a URL param through the ingest
 * contract into the column, then the filter the response table builds, through `buildWhereClause`,
 * back out of Postgres.
 */

const BLOCKS = [
  {
    id: "clbk1234567890123456789013",
    name: "Main Block",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const STORAGE_KEY = "flag";

/** A survey declaring one `boolean` ingested field. Rows written directly: the legacy columns the
 * reconcile derives from carry no dataType, so a typed field has no other way in. */
const seedSurvey = async (): Promise<TSurvey> => {
  const organization = await prisma.organization.create({ data: { name: "Filter Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Filter Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: "Filter Survey",
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      blocks: BLOCKS,
      hiddenFields: { enabled: true, fieldIds: [STORAGE_KEY] },
    },
    select: { id: true },
  });
  const field = await prisma.embeddedData.create({
    data: {
      name: "Flag",
      source: "ingested",
      dataType: "boolean",
      workspaceId: workspace.id,
      surveyId: survey.id,
    },
  });
  await prisma.surveyEmbeddedData.create({
    data: {
      workspaceId: workspace.id,
      surveyId: survey.id,
      embeddedDataId: field.id,
      storageKey: STORAGE_KEY,
      order: 0,
    },
  });

  const row = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id }, select: selectSurvey });
  return transformPrismaSurvey<TSurvey>(row);
};

/** The criteria the response table sends for one `Hidden Fields` row the author filled in. */
const filterCriteria = (survey: TSurvey, filterComboBoxValue: string): TResponseFilterCriteria =>
  getFormattedFilters(
    survey,
    {
      responseStatus: "all",
      filter: [
        {
          elementType: { type: "Hidden Fields", label: "Flag", id: STORAGE_KEY },
          filterType: { filterValue: "Equals", filterComboBoxValue },
        },
      ],
    },
    {} as never
  );

const findResponseIds = async (survey: TSurvey, value: string): Promise<string[]> => {
  const responses = await prisma.response.findMany({
    where: { surveyId: survey.id, ...buildWhereClause(survey, filterCriteria(survey, value)) },
    select: { id: true },
  });
  return responses.map(({ id }) => id);
};

beforeEach(async () => {
  await resetDb();
});

describe("filtering a boolean ingested field (real Postgres)", () => {
  test("a response ingested from ?flag=1 is what `equals true` returns", async () => {
    const survey = await seedSurvey();
    // What the link-survey URL reader hands the ingest contract for `?flag=1`.
    const ingested = applyIngestContractToResponseData(survey, { [STORAGE_KEY]: "1" });
    expect(ingested.data).toEqual({ [STORAGE_KEY]: "true" });

    const response = await prisma.response.create({
      data: { surveyId: survey.id, finished: true, data: ingested.data },
      select: { id: true },
    });

    expect(await findResponseIds(survey, "true")).toEqual([response.id]);
    // Not vacuous: the same column under the opposite spelling must not match.
    expect(await findResponseIds(survey, "false")).toEqual([]);
  });
});
