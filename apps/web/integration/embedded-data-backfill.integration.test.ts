import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { backfillEmbeddedDataRows } from "../../../packages/database/migration/20260812121944_backfill_embedded_data/migration";

/**
 * The ENG-1835 backfill against real Postgres.
 *
 * Everything that can go wrong here is database state: the unique constraints that decide which
 * surveys are migratable, the candidate query that makes re-runs a no-op, and the promise that
 * `Response` is never touched. The unit suite covers the mapping; none of this is visible there.
 */

const seedWorkspace = async (): Promise<string> => {
  const organization = await prisma.organization.create({ data: { name: "Backfill Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Backfill Workspace", organizationId: organization.id },
  });
  return workspace.id;
};

const seedSurvey = async (
  workspaceId: string,
  legacy: { variables?: unknown[]; fieldIds?: string[] },
  name = "Survey"
): Promise<string> => {
  const survey = await prisma.survey.create({
    data: {
      name,
      workspaceId,
      variables: (legacy.variables ?? []) as never,
      hiddenFields: { enabled: true, fieldIds: legacy.fieldIds ?? [] } as never,
    },
  });
  return survey.id;
};

/** The survey's fields as the tables now describe them, ordered for stable assertions. */
const readFields = async (surveyId: string) =>
  prisma.surveyEmbeddedData
    .findMany({
      where: { surveyId },
      orderBy: { storageKey: "asc" },
      select: {
        storageKey: true,
        embeddedData: {
          select: {
            workspaceId: true,
            name: true,
            source: true,
            dataType: true,
            defaultValue: true,
            key: true,
            surveyId: true,
          },
        },
      },
    })
    .then((links) => links.map((link) => ({ storageKey: link.storageKey, ...link.embeddedData })));

const numberVariable = { id: "clx000000000000000000001", name: "score", type: "number", value: 7 };

beforeEach(async () => {
  await resetDb();
});

describe("Embedded Data backfill (real Postgres)", () => {
  test("migrates a survey's variables and hidden fields, keeping their existing addresses", async () => {
    const workspaceId = await seedWorkspace();
    const surveyId = await seedSurvey(workspaceId, { variables: [numberVariable], fieldIds: ["plan"] });

    const stats = await backfillEmbeddedDataRows(prisma);

    expect(stats).toMatchObject({ migratedSurveys: 1, migratedFields: 2, skippedSurveys: [] });
    expect(await readFields(surveyId)).toEqual([
      {
        // The two invariants: a variable keeps its cuid, a hidden field keeps its name.
        storageKey: "clx000000000000000000001",
        workspaceId,
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 7,
        key: null,
        surveyId,
      },
      {
        storageKey: "plan",
        workspaceId,
        name: "plan",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        key: null,
        surveyId,
      },
    ]);
  });

  test("is a no-op on the second run", async () => {
    const workspaceId = await seedWorkspace();
    await seedSurvey(workspaceId, { fieldIds: ["plan", "campaign"] });

    await backfillEmbeddedDataRows(prisma);
    const second = await backfillEmbeddedDataRows(prisma);

    expect(second).toMatchObject({ migratedSurveys: 0, migratedFields: 0 });
    expect(await prisma.embeddedData.count()).toBe(2);
  });

  test("leaves alone a survey the write bridge already migrated", async () => {
    // The normal state before this migration ships: ENG-1978 migrated whatever was edited.
    const workspaceId = await seedWorkspace();
    const surveyId = await seedSurvey(workspaceId, { fieldIds: ["plan"] });
    const existing = await prisma.embeddedData.create({
      data: { workspaceId, surveyId, name: "plan", source: "ingested" },
    });
    await prisma.surveyEmbeddedData.create({
      data: { workspaceId, surveyId, embeddedDataId: existing.id, storageKey: "plan" },
    });

    const stats = await backfillEmbeddedDataRows(prisma);

    expect(stats.migratedSurveys).toBe(0);
    expect(await prisma.embeddedData.count()).toBe(1);
  });

  test("ignores surveys with nothing to migrate", async () => {
    const workspaceId = await seedWorkspace();
    await seedSurvey(workspaceId, {});

    const stats = await backfillEmbeddedDataRows(prisma);

    expect(stats).toMatchObject({ migratedSurveys: 0, migratedFields: 0 });
    expect(await prisma.embeddedData.count()).toBe(0);
  });

  test("migrates a duplicated survey and its original, which share variable cuids", async () => {
    // Duplication clones variable ids, so the same storageKey legitimately appears in both surveys.
    // Only `@@unique([surveyId, storageKey])` applies, so this must not collide.
    const workspaceId = await seedWorkspace();
    const original = await seedSurvey(workspaceId, { variables: [numberVariable] }, "Original");
    const copy = await seedSurvey(workspaceId, { variables: [numberVariable] }, "Original (copy)");

    const stats = await backfillEmbeddedDataRows(prisma);

    expect(stats.migratedSurveys).toBe(2);
    expect((await readFields(original)).map((field) => field.storageKey)).toEqual([numberVariable.id]);
    expect((await readFields(copy)).map((field) => field.storageKey)).toEqual([numberVariable.id]);
  });

  test("migrates surveys across workspaces into their own workspace", async () => {
    const [workspaceA, workspaceB] = await Promise.all([seedWorkspace(), seedWorkspace()]);
    const surveyA = await seedSurvey(workspaceA, { fieldIds: ["plan"] });
    const surveyB = await seedSurvey(workspaceB, { fieldIds: ["plan"] });

    await backfillEmbeddedDataRows(prisma);

    expect((await readFields(surveyA))[0].workspaceId).toBe(workspaceA);
    expect((await readFields(surveyB))[0].workspaceId).toBe(workspaceB);
    // Both rows carry `key: null`, so the workspace-level unique on `key` never fires.
    expect(await prisma.embeddedData.count()).toBe(2);
  });

  test("skips a survey whose declarations collide, and migrates the rest", async () => {
    // The one case that would otherwise abort everything: the runner puts the whole migration in a
    // single transaction, so one constraint violation would roll back every other survey.
    const workspaceId = await seedWorkspace();
    const broken = await seedSurvey(workspaceId, { fieldIds: ["plan", "plan"] }, "Broken");
    const healthy = await seedSurvey(workspaceId, { fieldIds: ["campaign"] }, "Healthy");

    const stats = await backfillEmbeddedDataRows(prisma);

    expect(stats.migratedSurveys).toBe(1);
    expect(stats.skippedSurveys).toEqual([{ surveyId: broken, duplicateStorageKeys: ["plan"] }]);
    expect(await readFields(broken)).toEqual([]);
    expect((await readFields(healthy)).map((field) => field.storageKey)).toEqual(["campaign"]);
  });

  test("never touches Response", async () => {
    const workspaceId = await seedWorkspace();
    const surveyId = await seedSurvey(workspaceId, { variables: [numberVariable], fieldIds: ["plan"] });
    await prisma.response.create({
      data: {
        surveyId,
        finished: true,
        data: { plan: "pro" },
        variables: { [numberVariable.id]: 42 },
        meta: {},
        ttc: {},
      },
    });

    await backfillEmbeddedDataRows(prisma);

    const response = await prisma.response.findFirstOrThrow({ where: { surveyId } });
    // The stored values are keyed by the same addresses the links now carry — which is why no
    // response migration is needed, and why recall and logic keep resolving after this runs.
    expect(response.data).toEqual({ plan: "pro" });
    expect(response.variables).toEqual({ [numberVariable.id]: 42 });
  });
});
