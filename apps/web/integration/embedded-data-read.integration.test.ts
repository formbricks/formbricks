import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * The Embedded Data read seam against real Postgres (ENG-1837).
 *
 * What only a real database can show: that the join in `selectSurvey` actually returns the rows the
 * write bridge wrote, that the inlined list — and the legacy `variables` / `hiddenFields` derived from
 * it since ENG-2404 dropped their columns — comes back in the order the export headers and pickers
 * depend on. The unit suite mocks `@formbricks/database`, so the join itself is invisible there.
 */

const LEGACY = {
  variables: [
    { id: "clx000000000000000000002", name: "tier", type: "text" as const, value: "free" },
    { id: "clx000000000000000000001", name: "score", type: "number" as const, value: 7 },
  ],
  hiddenFields: { enabled: true, fieldIds: ["utm_source", "plan"] },
};

const seedSurvey = async (): Promise<{ surveyId: string; workspaceId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Read Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Read Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({ data: { name: "Survey", workspaceId: workspace.id } });

  await prisma.$transaction((tx) =>
    reconcileEmbeddedData(tx, {
      surveyId: survey.id,
      workspaceId: workspace.id,
      patch: LEGACY,
    })
  );

  return { surveyId: survey.id, workspaceId: workspace.id };
};

/** The read path a survey page takes: the join in `selectSurvey`, inlined by `transformPrismaSurvey`. */
const loadSurvey = async (surveyId: string): Promise<TSurvey> => {
  const surveyPrisma = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: selectSurvey,
  });
  return transformPrismaSurvey<TSurvey>(surveyPrisma);
};

beforeEach(async () => {
  await resetDb();
});

/**
 * The pairs without the stored row id. ENG-3228 added it to the read so the editor can hand a shared
 * link back on the next save, and the legacy derivation has nothing to put there — so a comparison
 * against derived pairs has to drop it, and assert it separately.
 */
const withoutRowIds = (fields: TLinkedEmbeddedField[] | undefined) =>
  fields?.map(({ field: { id: _id, ...field }, link }) => ({ field, link }));

describe("Embedded Data read seam (real Postgres)", () => {
  test("a loaded survey carries the rows the write bridge wrote", async () => {
    const { surveyId } = await seedSurvey();

    const survey = await loadSurvey(surveyId);

    expect(withoutRowIds(survey.embeddedFields)).toEqual(embeddedFieldsFromLegacyInput(LEGACY));
    expect(withoutRowIds(getSurveyEmbeddedFields(survey))).toEqual(embeddedFieldsFromLegacyInput(LEGACY));
    // Every pair names the row it came from, which is what a save needs to address a shared link.
    expect(survey.embeddedFields?.every(({ field }) => typeof field.id === "string")).toBe(true);
  });

  test("the raw relation never leaks onto the survey object", async () => {
    const { surveyId } = await seedSurvey();

    expect(await loadSurvey(surveyId)).not.toHaveProperty("embeddedDataLinks");
  });

  test("the inlined order is the declared order, not the storage keys'", async () => {
    const { surveyId } = await seedSurvey();

    const survey = await loadSurvey(surveyId);

    // Declared order is variables-then-hidden-fields, and `tier` is declared before `score` even
    // though `clx…001` sorts before `clx…002`. Storage key is only the tie-break, so this passing
    // means the `order` column is what decided it — and this is CSV/XLSX header and picker order.
    expect(survey.embeddedFields?.map(({ link }) => link.storageKey)).toEqual([
      "clx000000000000000000002",
      "clx000000000000000000001",
      "utm_source",
      "plan",
    ]);
  });

  test("the legacy keys are derived from the rows, in row order", async () => {
    // ENG-2404: no column holds them any more. What v1/v3 and deployed SDK bundles read is this
    // projection, so its order is the rows' order — the same one the export and the pickers use.
    const { surveyId } = await seedSurvey();

    const survey = await loadSurvey(surveyId);

    expect(survey.variables).toEqual(LEGACY.variables);
    expect(survey.hiddenFields).toEqual(LEGACY.hiddenFields);
  });

  test("a survey with no rows reads as having no fields — there is no legacy fallback left", async () => {
    // ENG-2404 removed the zero-row fallback with the columns it fell back to: the migration that
    // dropped them gave every survey still without links its rows first.
    const { surveyId } = await seedSurvey();
    await prisma.surveyEmbeddedData.deleteMany({ where: { surveyId } });

    const survey = await loadSurvey(surveyId);

    expect(getSurveyEmbeddedFields(survey)).toEqual([]);
    expect(survey.variables).toEqual([]);
    expect(survey.hiddenFields).toEqual({ enabled: false, fieldIds: [] });
  });

  test("a partial row set wins outright — the rows are the source of truth once any exist", async () => {
    // Not reachable today: `reconcileEmbeddedData` writes the whole desired set in one plan. Asserted
    // so that whatever rows exist are the whole answer, with nothing filling in the gap.
    const { surveyId } = await seedSurvey();
    await prisma.surveyEmbeddedData.deleteMany({ where: { surveyId, storageKey: { in: ["plan"] } } });

    const survey = await loadSurvey(surveyId);

    expect(getSurveyEmbeddedFields(survey).map(({ link }) => link.storageKey)).toEqual([
      "clx000000000000000000002",
      "clx000000000000000000001",
      "utm_source",
    ]);
  });

  test("reading a survey writes nothing to the Embedded Data tables", async () => {
    const { surveyId } = await seedSurvey();
    const before = await prisma.surveyEmbeddedData.findMany({ where: { surveyId } });

    await loadSurvey(surveyId);

    expect(await prisma.surveyEmbeddedData.findMany({ where: { surveyId } })).toEqual(before);
  });
});
