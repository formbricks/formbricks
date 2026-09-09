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

/** A variable's storage key is its cuid, so a rename moves the name but never the address. */
const VARIABLE_ID = "clvar123456789012345678901";

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
      patch: survey,
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
      { variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }] },
      "req_v3_patch_add_variable"
    );

    expect(await readRows(survey.id)).toEqual([
      {
        storageKey: VARIABLE_ID,
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
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
    });

    await patchV3Survey(
      survey,
      { variables: [{ id: VARIABLE_ID, name: "renamed_score", type: "number", value: 9 }] },
      "req_v3_patch_rename_variable"
    );

    expect(await readRows(survey.id)).toEqual([
      {
        storageKey: VARIABLE_ID,
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
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["utm_source", "plan"] },
    });

    await patchV3Survey(
      survey,
      { hiddenFields: { enabled: true, fieldIds: ["plan"] } },
      "req_v3_patch_remove_hidden_field"
    );

    expect((await readRows(survey.id)).map(({ storageKey }) => storageKey)).toEqual([VARIABLE_ID, "plan"]);
    await expectRowsAgreeWithColumns(survey.id);
  });

  test("a patch that touches neither key leaves the rows alone", async () => {
    // The patch document carries no `variables` / `hiddenFields`, so the reconcile has to read the
    // persisted survey — reading the payload would see them as absent and unlink every field.
    const survey = await seedSurvey({
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
    });
    const before = await readRows(survey.id);

    await patchV3Survey(survey, { name: "Renamed survey" }, "req_v3_patch_name_only");

    expect(await readRows(survey.id)).toEqual(before);
    await expectRowsAgreeWithColumns(survey.id);
  });

  test("renaming both kinds of field leaves stored responses byte-identical (AC #4)", async () => {
    // The realistic violation is not a Response being created — it is a reconcile that "helpfully"
    // migrates stored answers when a field's address changes. So the response has to actually HOLD
    // the keys being renamed, in both maps, or a mutation would have nothing to corrupt.
    const survey = await seedSurvey({
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
    });

    const storedData = { utm_source: "google", satisfaction: "great" };
    const storedVariables = { [VARIABLE_ID]: 42 };
    const response = await prisma.response.create({
      data: {
        surveyId: survey.id,
        finished: true,
        data: storedData as never,
        variables: storedVariables as never,
      },
      select: { id: true, updatedAt: true },
    });

    await patchV3Survey(
      survey,
      {
        // Both addresses move: the hidden field's storage key IS its name, and the variable keeps its
        // cuid while its name changes — the two shapes a migration would treat differently.
        hiddenFields: { enabled: true, fieldIds: ["renamed_source"] },
        variables: [{ id: VARIABLE_ID, name: "renamed_score", type: "number", value: 7 }],
      },
      "req_v3_patch_no_response_write"
    );

    // The definitions moved...
    expect((await readRows(survey.id)).map(({ storageKey, name }) => `${storageKey}:${name}`)).toEqual([
      `${VARIABLE_ID}:renamed_score`,
      "renamed_source:renamed_source",
    ]);

    // ...and the response did not. Both maps compared whole, so a re-keyed, added or dropped entry
    // fails — not just a changed value.
    const stored = await prisma.response.findUniqueOrThrow({
      where: { id: response.id },
      select: { data: true, variables: true, updatedAt: true },
    });
    expect(stored.data).toEqual(storedData);
    expect(stored.variables).toEqual(storedVariables);
    // A rewrite that happened to produce the same JSON would still bump `updatedAt` (@updatedAt).
    expect(stored.updatedAt).toEqual(response.updatedAt);

    // And nothing was inserted or deleted either.
    expect(await prisma.response.count({ where: { surveyId: survey.id } })).toBe(1);
  });
});
