import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";

/**
 * Embedded Data tenancy, against real Postgres (ENG-1833).
 *
 * `EmbeddedData` and `SurveyEmbeddedData` are scoped to a workspace by composite foreign keys that
 * carry `workspaceId` — `(surveyId, workspaceId)` and `(embeddedDataId, workspaceId)`, both pointing
 * at `@@unique([id, workspaceId])`. Nothing else stops a survey linking another workspace's field,
 * so that guarantee lives entirely in DDL: `ZSurveyEmbeddedData` checks that `workspaceId` is
 * present, never that the two foreign keys agree on it, and the unit suite mocks the database.
 *
 * Weakening either relation back to a single column therefore leaves `prisma validate` and the whole
 * unit suite green. These tests are what notices — and ENG-1835, 1836, 1837 and 1978 all still have
 * to alter these tables.
 */

/** Two workspaces under one organization, each with a survey. */
const seedTwoWorkspaces = async (): Promise<{
  workspaceA: string;
  workspaceB: string;
  surveyA: string;
  surveyB: string;
}> => {
  const organization = await prisma.organization.create({ data: { name: "Tenancy Org" } });
  const [workspaceA, workspaceB] = await Promise.all([
    prisma.workspace.create({ data: { name: "Workspace A", organizationId: organization.id } }),
    prisma.workspace.create({ data: { name: "Workspace B", organizationId: organization.id } }),
  ]);
  const [surveyA, surveyB] = await Promise.all([
    prisma.survey.create({ data: { name: "Survey A", workspaceId: workspaceA.id } }),
    prisma.survey.create({ data: { name: "Survey B", workspaceId: workspaceB.id } }),
  ]);
  return { workspaceA: workspaceA.id, workspaceB: workspaceB.id, surveyA: surveyA.id, surveyB: surveyB.id };
};

/**
 * Runs `operation` and returns the foreign-key constraint it violated.
 *
 * Asserting the constraint by name is the point: a plain "it threw" would still pass if a later
 * migration recreated the key single-column, because the row would then fail some other way (or not
 * at all). Prisma reports the name under `meta.constraint` for P2003.
 */
const violatedConstraint = async (operation: () => Promise<unknown>): Promise<string> => {
  try {
    await operation();
  } catch (error) {
    const meta = (error as { code?: string; meta?: { constraint?: unknown } }).meta;
    return String(meta?.constraint ?? error);
  }
  throw new Error("Expected the write to be rejected, but it succeeded");
};

beforeEach(async () => {
  await resetDb();
});

describe("Embedded Data is scoped to a workspace by the database (real Postgres)", () => {
  test("a shared field with no owning survey is accepted", async () => {
    const { workspaceA } = await seedTwoWorkspaces();

    const field = await prisma.embeddedData.create({
      data: { name: "Plan tier", key: "plan_tier", source: "ingested", workspaceId: workspaceA },
    });

    expect(field.surveyId).toBeNull();
  });

  test("a local field owned by a survey in the same workspace is accepted", async () => {
    const { workspaceA, surveyA } = await seedTwoWorkspaces();

    const field = await prisma.embeddedData.create({
      data: {
        name: "Score",
        source: "computed",
        dataType: "number",
        workspaceId: workspaceA,
        surveyId: surveyA,
      },
    });

    expect(field.surveyId).toBe(surveyA);
  });

  test("a local field cannot be owned by a survey in another workspace", async () => {
    const { workspaceA, surveyB } = await seedTwoWorkspaces();

    const constraint = await violatedConstraint(() =>
      prisma.embeddedData.create({
        data: {
          name: "Score",
          source: "computed",
          dataType: "number",
          workspaceId: workspaceA,
          surveyId: surveyB,
        },
      })
    );

    expect(constraint).toContain("EmbeddedData_surveyId_workspaceId_fkey");
  });

  test("a survey cannot link a field defined in another workspace", async () => {
    const { workspaceA, workspaceB, surveyB } = await seedTwoWorkspaces();
    const fieldInA = await prisma.embeddedData.create({
      data: { name: "Plan tier", key: "plan_tier", source: "ingested", workspaceId: workspaceA },
    });

    const constraint = await violatedConstraint(() =>
      prisma.surveyEmbeddedData.create({
        data: {
          workspaceId: workspaceB,
          surveyId: surveyB,
          embeddedDataId: fieldInA.id,
          storageKey: "plan_tier",
          order: 0,
        },
      })
    );

    expect(constraint).toContain("SurveyEmbeddedData_embeddedDataId_workspaceId_fkey");
  });

  test("a link cannot name a survey from a workspace other than its own", async () => {
    const { workspaceA, surveyB } = await seedTwoWorkspaces();
    const fieldInA = await prisma.embeddedData.create({
      data: { name: "Plan tier", key: "plan_tier", source: "ingested", workspaceId: workspaceA },
    });

    const constraint = await violatedConstraint(() =>
      prisma.surveyEmbeddedData.create({
        data: {
          workspaceId: workspaceA,
          surveyId: surveyB,
          embeddedDataId: fieldInA.id,
          storageKey: "plan_tier",
          order: 0,
        },
      })
    );

    expect(constraint).toContain("SurveyEmbeddedData_surveyId_workspaceId_fkey");
  });

  test("deleting a survey removes its local field and its links, but not the shared library", async () => {
    const { workspaceA, surveyA } = await seedTwoWorkspaces();
    const [shared, local] = await Promise.all([
      prisma.embeddedData.create({
        data: { name: "Plan tier", key: "plan_tier", source: "ingested", workspaceId: workspaceA },
      }),
      prisma.embeddedData.create({
        data: {
          name: "Score",
          source: "computed",
          dataType: "number",
          workspaceId: workspaceA,
          surveyId: surveyA,
        },
      }),
    ]);
    await prisma.surveyEmbeddedData.create({
      data: {
        workspaceId: workspaceA,
        surveyId: surveyA,
        embeddedDataId: shared.id,
        storageKey: "plan_tier",
        order: 0,
      },
    });

    await prisma.survey.delete({ where: { id: surveyA } });

    expect(await prisma.embeddedData.findUnique({ where: { id: local.id } })).toBeNull();
    expect(await prisma.surveyEmbeddedData.count()).toBe(0);
    expect(await prisma.embeddedData.findUnique({ where: { id: shared.id } })).not.toBeNull();
  });
});
