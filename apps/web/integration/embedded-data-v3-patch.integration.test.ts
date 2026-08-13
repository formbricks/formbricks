import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { patchV3Survey } from "@/app/api/v3/surveys/patch";
import { resetDb } from "@/integration/reset-db";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * The v3 PATCH write path against real Postgres (ENG-1837).
 *
 * `PATCH /api/v3/surveys/{surveyId}` and MCP `patch_survey` write `variables` / `hiddenFields`
 * straight through `survey.update`. Once readers resolve definitions through the EmbeddedData tables,
 * a patch that does not reconcile leaves the rows describing the pre-patch survey — a variable added
 * over the API would be invisible to the logic engine, the export columns and the response filters,
 * and a deleted one would keep its column. The unit suite mocks `@formbricks/database`, so only a
 * real database shows that the rows actually end up agreeing with the columns.
 */

const BLOCKS = [
  {
    id: "clbk1234567890123456789012",
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

const seedSurvey = async (legacy?: {
  variables?: unknown[];
  hiddenFields?: { enabled: boolean; fieldIds?: string[] };
}): Promise<TSurvey> => {
  const organization = await prisma.organization.create({ data: { name: "V3 Patch Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "V3 Patch Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: "Product Feedback",
      type: "link",
      status: "draft",
      workspaceId: workspace.id,
      blocks: BLOCKS,
      variables: (legacy?.variables ?? []) as never,
      hiddenFields: (legacy?.hiddenFields ?? { enabled: false }) as never,
    },
    select: selectSurvey,
  });

  // Mirror the state every stored survey is in: rows reconciled from the columns it was saved with.
  await prisma.$transaction((tx) =>
    reconcileEmbeddedData(tx, {
      surveyId: survey.id,
      workspaceId: workspace.id,
      desired: toDesiredEmbeddedFields(survey),
    })
  );

  return transformPrismaSurvey<TSurvey>(survey);
};

/** The survey's rows, in the shape `toDesiredEmbeddedFields` produces, so the two can be compared. */
const readRows = async (surveyId: string) =>
  prisma.surveyEmbeddedData
    .findMany({
      where: { surveyId },
      select: {
        storageKey: true,
        embeddedData: { select: { name: true, source: true, dataType: true, defaultValue: true } },
      },
    })
    .then((links) =>
      links
        .map(({ storageKey, embeddedData }) => ({ storageKey, ...embeddedData }))
        .sort((a, b) => a.storageKey.localeCompare(b.storageKey))
    );

/** What the rows SHOULD be, read back from the columns the patch persisted. */
const expectedRowsFromColumns = async (surveyId: string) => {
  const survey = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: { variables: true, hiddenFields: true },
  });

  return toDesiredEmbeddedFields(survey).sort((a, b) => a.storageKey.localeCompare(b.storageKey));
};

const expectRowsAgreeWithColumns = async (surveyId: string) => {
  expect(await readRows(surveyId)).toEqual(await expectedRowsFromColumns(surveyId));
};

beforeEach(async () => {
  await resetDb();
});

describe("v3 survey patch keeps the Embedded Data rows in step (real Postgres)", () => {
  test("a patch that adds a variable writes its row and link", async () => {
    const survey = await seedSurvey();

    await patchV3Survey(
      survey,
      { variables: [{ id: "clvar123456789012345678901", name: "score", type: "number", value: 7 }] },
      "req_v3_patch_add_variable"
    );

    expect(await readRows(survey.id)).toEqual([
      {
        storageKey: "clvar123456789012345678901",
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 7,
      },
    ]);
    await expectRowsAgreeWithColumns(survey.id);
  });

  test("a patch that adds a hidden field writes its row and link", async () => {
    const survey = await seedSurvey();

    await patchV3Survey(
      survey,
      { hiddenFields: { enabled: true, fieldIds: ["utm_source"] } },
      "req_v3_patch_add_hidden_field"
    );

    expect(await readRows(survey.id)).toEqual([
      {
        storageKey: "utm_source",
        name: "utm_source",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
      },
    ]);
    await expectRowsAgreeWithColumns(survey.id);
  });

  test("a patch that renames a variable updates its row rather than orphaning it", async () => {
    const survey = await seedSurvey({
      variables: [{ id: "clvar123456789012345678901", name: "score", type: "number", value: 7 }],
    });

    await patchV3Survey(
      survey,
      { variables: [{ id: "clvar123456789012345678901", name: "renamed_score", type: "number", value: 9 }] },
      "req_v3_patch_rename_variable"
    );

    expect(await readRows(survey.id)).toEqual([
      {
        storageKey: "clvar123456789012345678901",
        name: "renamed_score",
        source: "computed",
        dataType: "number",
        defaultValue: 9,
      },
    ]);
    await expectRowsAgreeWithColumns(survey.id);
  });

  test("a patch that removes a field drops its row, so it stops appearing as a column", async () => {
    const survey = await seedSurvey({
      variables: [{ id: "clvar123456789012345678901", name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["utm_source", "plan"] },
    });

    await patchV3Survey(
      survey,
      { hiddenFields: { enabled: true, fieldIds: ["plan"] } },
      "req_v3_patch_remove_hidden_field"
    );

    expect((await readRows(survey.id)).map(({ storageKey }) => storageKey)).toEqual([
      "clvar123456789012345678901",
      "plan",
    ]);
    await expectRowsAgreeWithColumns(survey.id);
  });

  test("a patch that touches neither key leaves the rows alone", async () => {
    // The patch document carries no `variables` / `hiddenFields`, so the reconcile has to read the
    // persisted survey — reading the payload would see them as absent and unlink every field.
    const survey = await seedSurvey({
      variables: [{ id: "clvar123456789012345678901", name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
    });
    const before = await readRows(survey.id);

    await patchV3Survey(survey, { name: "Renamed survey" }, "req_v3_patch_name_only");

    expect(await readRows(survey.id)).toEqual(before);
    await expectRowsAgreeWithColumns(survey.id);
  });

  test("writes nothing to Response", async () => {
    const survey = await seedSurvey({
      hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
    });

    await patchV3Survey(
      survey,
      { hiddenFields: { enabled: true, fieldIds: ["renamed_source"] } },
      "req_v3_patch_no_response_write"
    );

    expect(await prisma.response.count({ where: { surveyId: survey.id } })).toBe(0);
  });
});
