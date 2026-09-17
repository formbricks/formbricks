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
 * Filtering a typed ingested Embedded Data field against real Postgres (ENG-3231, ENG-3232).
 *
 * The bug the boolean case exists to keep out was invisible to both unit suites, because each one
 * was internally consistent: ingest stores the string `"true"` (there is no boolean member in
 * `ZResponseDataValue`), the filter built a real jsonb boolean, and no test ran one against the
 * other. A jsonb `=` between `"true"` and `true` is false, so `is_pro equals true` returned nothing
 * the moment a boolean field held a value — and only a real column can show that, since the unit
 * harness mocks Prisma away and would have happily "matched" either shape.
 *
 * The date case is the same class of disagreement one level up: the filter's value is a day and the
 * column holds days *and* instants, so what a unit test can pin is the window the filter asks for,
 * while whether jsonb agrees that `"2026-09-01" <= "2026-09-01T10:30:00Z" < "2026-09-02"` is a
 * question only Postgres answers.
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

/** A survey declaring one ingested field of `dataType`. Rows written directly: the legacy columns
 * the reconcile derives from carry no dataType, so a typed field has no other way in. */
const seedSurvey = async (dataType: "boolean" | "date"): Promise<TSurvey> => {
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
      dataType,
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
const filterCriteria = (
  survey: TSurvey,
  filterValue: string,
  filterComboBoxValue: string
): TResponseFilterCriteria =>
  getFormattedFilters(
    survey,
    {
      responseStatus: "all",
      filter: [
        {
          elementType: { type: "Hidden Fields", label: "Flag", id: STORAGE_KEY },
          filterType: { filterValue, filterComboBoxValue },
        },
      ],
    },
    {} as never
  );

const findResponseIds = async (survey: TSurvey, filterValue: string, value: string): Promise<string[]> => {
  const responses = await prisma.response.findMany({
    where: {
      surveyId: survey.id,
      ...buildWhereClause(survey, filterCriteria(survey, filterValue, value)),
    },
    select: { id: true },
  });
  // Sorted, not ordered by the column: the rows differ only in their stored value, and nothing in
  // the assertions below rests on which order Postgres returns them in.
  return responses.map(({ id }) => id).sort((a, b) => a.localeCompare(b));
};

beforeEach(async () => {
  await resetDb();
});

describe("filtering a boolean ingested field (real Postgres)", () => {
  test("a response ingested from ?flag=1 is what `equals true` returns", async () => {
    const survey = await seedSurvey("boolean");
    // What the link-survey URL reader hands the ingest contract for `?flag=1`.
    const ingested = applyIngestContractToResponseData(survey, { [STORAGE_KEY]: "1" });
    expect(ingested.data).toEqual({ [STORAGE_KEY]: "true" });

    const response = await prisma.response.create({
      data: { surveyId: survey.id, finished: true, data: ingested.data },
      select: { id: true },
    });

    expect(await findResponseIds(survey, "Equals", "true")).toEqual([response.id]);
    // Not vacuous: the same column under the opposite spelling must not match.
    expect(await findResponseIds(survey, "Equals", "false")).toEqual([]);
  });
});

describe("filtering a date ingested field (real Postgres)", () => {
  /** One response per `?flag=` value, plus one that never carried the param. */
  const seedResponses = async (survey: TSurvey, rawValues: string[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const raw of rawValues) {
      const ingested = applyIngestContractToResponseData(survey, { [STORAGE_KEY]: raw });
      // The ticket's decision, asserted rather than assumed: ingest stores what arrived, so the
      // column holds a day or an instant exactly as it was sent — there is nothing to normalize
      // here, which is why the filter has to do it.
      expect(ingested.data).toEqual({ [STORAGE_KEY]: raw });
      const { id } = await prisma.response.create({
        data: { surveyId: survey.id, finished: true, data: ingested.data },
        select: { id: true },
      });
      ids.push(id);
    }
    return ids;
  };

  test("a day-granular filter value answers for the whole day, however the value was stored", async () => {
    const survey = await seedSurvey("date");
    const [dayBefore, storedDate, storedDateTime, dayAfter] = await seedResponses(survey, [
      "2026-08-31T23:59:59Z",
      "2026-09-01",
      "2026-09-01T10:30:00Z",
      "2026-09-02",
    ]);
    const { id: noValue } = await prisma.response.create({
      data: { surveyId: survey.id, finished: true, data: {} },
      select: { id: true },
    });
    const sorted = (...ids: string[]) => ids.sort((a, b) => a.localeCompare(b));
    const matching = (filterValue: string) => findResponseIds(survey, filterValue, "2026-09-01");

    // The stored datetime is the row that was missing: a day compared as an equality never equalled
    // an instant on it (ENG-3232).
    expect(await matching("Equals")).toEqual(sorted(storedDate, storedDateTime));
    // …and the row that wrongly matched: 10:30 on 1 Sep is not after 1 Sep.
    expect(await matching("Is after")).toEqual([dayAfter]);
    expect(await matching("Is before")).toEqual([dayBefore]);
    // The complement of `Equals`, and an absent value counts as not on that day — the same stance
    // `notEquals` takes everywhere else in the data group.
    expect(await matching("Not equals")).toEqual(sorted(dayBefore, dayAfter, noValue));
  });
});
