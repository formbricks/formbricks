import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { deriveLegacyEmbeddedData, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * The Embedded Data read seam against real Postgres (ENG-1837).
 *
 * What only a real database can show: that the join in `selectSurvey` actually returns the rows the
 * write bridge wrote, that the inlined list comes back in the order the export headers and pickers
 * depend on, and that a survey whose rows are missing still resolves off its legacy columns. The unit
 * suite mocks `@formbricks/database`, so the join itself is invisible there.
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
  const survey = await prisma.survey.create({
    data: {
      name: "Survey",
      workspaceId: workspace.id,
      variables: LEGACY.variables,
      hiddenFields: LEGACY.hiddenFields,
    },
  });

  await prisma.$transaction((tx) =>
    reconcileEmbeddedData(tx, {
      surveyId: survey.id,
      workspaceId: workspace.id,
      desired: toDesiredEmbeddedFields(LEGACY),
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

describe("Embedded Data read seam (real Postgres)", () => {
  test("a loaded survey carries the rows the write bridge wrote", async () => {
    const { surveyId } = await seedSurvey();

    const survey = await loadSurvey(surveyId);

    expect(survey.embeddedFields).toEqual(deriveLegacyEmbeddedData(LEGACY));
    expect(getSurveyEmbeddedFields(survey)).toEqual(deriveLegacyEmbeddedData(LEGACY));
  });

  test("the raw relation never leaks onto the survey object", async () => {
    const { surveyId } = await seedSurvey();

    expect(await loadSurvey(surveyId)).not.toHaveProperty("embeddedDataLinks");
  });

  test("the inlined order is the declared order, not the database's", async () => {
    const { surveyId } = await seedSurvey();

    const survey = await loadSurvey(surveyId);

    // Declared order is variables-then-hidden-fields, and `tier` is declared before `score` even
    // though `clx…001` sorts before `clx…002`. This is CSV/XLSX header order and picker order.
    expect(survey.embeddedFields?.map(({ link }) => link.storageKey)).toEqual([
      "clx000000000000000000002",
      "clx000000000000000000001",
      "utm_source",
      "plan",
    ]);
  });

  test("a survey that missed the backfill still resolves off its legacy columns", async () => {
    const { surveyId } = await seedSurvey();
    await prisma.surveyEmbeddedData.deleteMany({ where: { surveyId } });

    const survey = await loadSurvey(surveyId);

    expect(survey.embeddedFields).toEqual([]);
    expect(getSurveyEmbeddedFields(survey)).toEqual(deriveLegacyEmbeddedData(LEGACY));
  });

  test("a partial row set wins outright — the rows are the source of truth once any exist", async () => {
    // Not reachable today: `reconcileEmbeddedData` writes the whole derived set in one plan. Asserted
    // so the fallback's "empty list only" rule is a decision on record rather than an accident.
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
