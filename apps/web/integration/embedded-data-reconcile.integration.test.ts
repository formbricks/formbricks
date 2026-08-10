import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { resetDb } from "@/integration/reset-db";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";

/**
 * The Embedded Data write bridge against real Postgres (ENG-1978).
 *
 * The reconcile is the only thing keeping the tables in step with what the editor saved, and every
 * rule it enforces is about database state: the unique constraint on `(surveyId, storageKey)`, the
 * cascade when a survey goes, and the ordering needed for a replaced field. The unit suite mocks
 * `@formbricks/database`, so none of that is visible there.
 */

const seedSurvey = async (): Promise<{ surveyId: string; workspaceId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Reconcile Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Reconcile Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({ data: { name: "Survey", workspaceId: workspace.id } });
  return { surveyId: survey.id, workspaceId: workspace.id };
};

/** What the survey actually has, in the shape the assertions care about. */
const readFields = async (surveyId: string) =>
  prisma.surveyEmbeddedData
    .findMany({
      where: { surveyId },
      orderBy: { storageKey: "asc" },
      select: {
        storageKey: true,
        embeddedData: {
          select: { name: true, source: true, dataType: true, defaultValue: true, key: true, surveyId: true },
        },
      },
    })
    .then((links) =>
      links.map((link) => ({
        storageKey: link.storageKey,
        ...link.embeddedData,
      }))
    );

const reconcile = (
  surveyId: string,
  workspaceId: string,
  legacy: Parameters<typeof toDesiredEmbeddedFields>[0]
) =>
  prisma.$transaction((tx) =>
    reconcileEmbeddedData(tx, { surveyId, workspaceId, desired: toDesiredEmbeddedFields(legacy) })
  );

beforeEach(async () => {
  await resetDb();
});

describe("reconcileEmbeddedData (real Postgres)", () => {
  test("creates a row and a link for each variable and hidden field", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    await reconcile(surveyId, workspaceId, {
      variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    expect(await readFields(surveyId)).toEqual([
      {
        storageKey: "clx000000000000000000001",
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 7,
        // Local: owned by this survey and absent from the shared library.
        key: null,
        surveyId,
      },
      {
        storageKey: "plan",
        name: "plan",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        key: null,
        surveyId,
      },
    ]);
  });

  test("is idempotent — running it again changes nothing", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const legacy = { hiddenFields: { enabled: true, fieldIds: ["plan", "campaign"] } };

    await reconcile(surveyId, workspaceId, legacy);
    const first = await readFields(surveyId);
    await reconcile(surveyId, workspaceId, legacy);

    expect(await readFields(surveyId)).toEqual(first);
    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(2);
  });

  test("removes the row and the link for a deleted field", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, {
      hiddenFields: { enabled: true, fieldIds: ["plan", "campaign"] },
    });

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    expect((await readFields(surveyId)).map((field) => field.storageKey)).toEqual(["plan"]);
    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(1);
  });

  test("updates a field whose default value changed, keeping the same row", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const variable = { id: "clx000000000000000000001", name: "score", type: "number" as const };
    await reconcile(surveyId, workspaceId, { variables: [{ ...variable, value: 0 }] });
    const before = await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } });

    await reconcile(surveyId, workspaceId, { variables: [{ ...variable, value: 99 }] });

    const after = await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } });
    expect(after.id).toBe(before.id);
    expect(after.defaultValue).toBe(99);
  });

  test("replaces a field whose source changed, which reuses the same storage key", async () => {
    // Unlink has to happen before create or `@@unique([surveyId, storageKey])` rejects the new row.
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    await reconcile(surveyId, workspaceId, {
      variables: [{ id: "plan", name: "plan", type: "text", value: "pro" }],
    });

    expect(await readFields(surveyId)).toMatchObject([{ storageKey: "plan", source: "computed" }]);
    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(1);
  });

  test("keeps a legacy hidden field name exactly as stored", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["Brand-Name"] } });

    expect((await readFields(surveyId)).map((field) => field.storageKey)).toEqual(["Brand-Name"]);
  });

  test("rejects a duplicate field name within one survey", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    await expect(
      reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan", "plan"] } })
    ).rejects.toThrow(/plan/);

    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(0);
  });

  test("lets two surveys in one workspace both hold a field named plan", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const other = await prisma.survey.create({ data: { name: "Other", workspaceId } });
    const legacy = { hiddenFields: { enabled: true, fieldIds: ["plan"] } };

    await reconcile(surveyId, workspaceId, legacy);
    await reconcile(other.id, workspaceId, legacy);

    // Both rows carry `key: null`, and Postgres treats NULLs as distinct, so the workspace-level
    // unique on `key` does not fire.
    expect(await prisma.embeddedData.count({ where: { workspaceId } })).toBe(2);
  });

  test("unlinks a shared library field without deleting or editing it", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const shared = await prisma.embeddedData.create({
      data: { workspaceId, key: "plan_tier", name: "Plan tier", source: "ingested" },
    });
    await prisma.surveyEmbeddedData.create({
      data: { workspaceId, surveyId, embeddedDataId: shared.id, storageKey: "plan_tier" },
    });

    // The legacy cards know nothing about the shared library, so a save that omits the field must
    // drop this survey's use of it and leave the workspace-owned definition alone.
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: [] } });

    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(0);
    expect(await prisma.embeddedData.findUnique({ where: { id: shared.id } })).toMatchObject({
      name: "Plan tier",
      key: "plan_tier",
    });
  });

  test("cascades a survey's fields away when the survey is deleted", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    await prisma.survey.delete({ where: { id: surveyId } });

    expect(await prisma.embeddedData.count({ where: { workspaceId } })).toBe(0);
    expect(await prisma.surveyEmbeddedData.count()).toBe(0);
  });

  test("never touches Response", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    await prisma.response.create({
      data: { surveyId, finished: true, data: { plan: "pro" }, variables: {}, meta: {}, ttc: {} },
    });

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: [] } });

    const response = await prisma.response.findFirstOrThrow({ where: { surveyId } });
    // Removing the definition leaves the stored value alone: the response is keyed by the same
    // storage key, which is exactly why no response migration is needed.
    expect(response.data).toEqual({ plan: "pro" });
  });
});
