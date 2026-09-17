import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import {
  createSharedEmbeddedData,
  deleteSharedEmbeddedData,
  getEmbeddedDataUsage,
  getSharedEmbeddedData,
  promoteEmbeddedDataToShared,
  updateSharedEmbeddedData,
} from "@/modules/embedded-data/lib/library";
import { EmbeddedDataInUseError, EmbeddedDataKeyConflictError } from "@/modules/embedded-data/types";

/**
 * The shared Embedded Data library against real Postgres (ENG-3229).
 *
 * Everything the service guards is a claim about database state that the unit suite — which mocks
 * `@formbricks/database` — cannot make: that `@@unique([workspaceId, key])` is what rejects a second
 * field under the same name, that promote moves the ownership columns and nothing else (the survey's
 * link row and its `storageKey` survive it untouched), that the cascade from `SurveyEmbeddedData` is
 * what makes an in-use delete dangerous, and that a workspace-scoped `where` really does hide another
 * tenant's row rather than merely intending to.
 */

/** Two workspaces under one organization, the first with a survey. */
const seed = async (): Promise<{ workspaceA: string; workspaceB: string; surveyId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Library Org" } });
  const [workspaceA, workspaceB] = await Promise.all([
    prisma.workspace.create({ data: { name: "Workspace A", organizationId: organization.id } }),
    prisma.workspace.create({ data: { name: "Workspace B", organizationId: organization.id } }),
  ]);
  const survey = await prisma.survey.create({ data: { name: "Onboarding", workspaceId: workspaceA.id } });

  return { workspaceA: workspaceA.id, workspaceB: workspaceB.id, surveyId: survey.id };
};

/** A survey's own field, plus the link addressing it — what promote has to leave alone. */
const seedLocalField = async (
  workspaceId: string,
  surveyId: string,
  storageKey = "plan_tier"
): Promise<{ fieldId: string; linkId: string }> => {
  const field = await prisma.embeddedData.create({
    data: { name: "Plan tier", source: "ingested", workspaceId, surveyId },
  });
  const link = await prisma.surveyEmbeddedData.create({
    data: { workspaceId, surveyId, embeddedDataId: field.id, storageKey, order: 0 },
  });

  return { fieldId: field.id, linkId: link.id };
};

const linkSharedField = (workspaceId: string, surveyId: string, embeddedDataId: string, storageKey: string) =>
  prisma.surveyEmbeddedData.create({
    data: { workspaceId, surveyId, embeddedDataId, storageKey, order: 0 },
  });

beforeEach(async () => {
  await resetDb();
});

describe("creating library fields (real Postgres)", () => {
  test("a second field under the same key is refused by the unique index", async () => {
    const { workspaceA } = await seed();
    const input = { key: "plan_tier", name: "Plan tier", source: "ingested" as const };

    await createSharedEmbeddedData(workspaceA, input);
    const error = await createSharedEmbeddedData(workspaceA, input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmbeddedDataKeyConflictError);
    expect((error as EmbeddedDataKeyConflictError).message).toBe("Embedded data key already exists");
  });

  test("the same key in another workspace is a different field, since the index is per workspace", async () => {
    const { workspaceA, workspaceB } = await seed();
    const input = { key: "plan_tier", name: "Plan tier", source: "ingested" as const };

    await createSharedEmbeddedData(workspaceA, input);

    await expect(createSharedEmbeddedData(workspaceB, input)).resolves.toMatchObject({ key: "plan_tier" });
  });

  test("the library lists only shared rows, never a survey's own", async () => {
    const { workspaceA, surveyId } = await seed();
    await seedLocalField(workspaceA, surveyId);
    await createSharedEmbeddedData(workspaceA, {
      key: "plan_tier",
      name: "Plan tier",
      source: "ingested",
    });

    const library = await getSharedEmbeddedData(workspaceA);

    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({ key: "plan_tier", surveyId: null, surveyCount: 0 });
  });
});

describe("promoting a local field (real Postgres)", () => {
  test("flips surveyId and key while the link and its storage key stay exactly where they were", async () => {
    const { workspaceA, surveyId } = await seed();
    const { fieldId, linkId } = await seedLocalField(workspaceA, surveyId);

    const promoted = await promoteEmbeddedDataToShared(fieldId, workspaceA, { key: "plan_tier" });

    expect(promoted).toMatchObject({ id: fieldId, key: "plan_tier", surveyId: null });
    // The survey keeps the field: same link row, same address, so its stored responses still resolve.
    const link = await prisma.surveyEmbeddedData.findUnique({ where: { id: linkId } });
    expect(link).toMatchObject({ id: linkId, surveyId, embeddedDataId: fieldId, storageKey: "plan_tier" });
    // And the promoted field now shows up in the library, counted against that survey.
    expect(await getSharedEmbeddedData(workspaceA)).toEqual([
      expect.objectContaining({ id: fieldId, surveyCount: 1 }),
    ]);
  });

  test("promoting onto a taken key answers with the id of the library row holding it", async () => {
    const { workspaceA, surveyId } = await seed();
    const existing = await createSharedEmbeddedData(workspaceA, {
      key: "plan_tier",
      name: "Plan tier",
      source: "ingested",
    });
    const { fieldId } = await seedLocalField(workspaceA, surveyId);

    const error = await promoteEmbeddedDataToShared(fieldId, workspaceA, { key: "plan_tier" }).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(EmbeddedDataKeyConflictError);
    expect((error as EmbeddedDataKeyConflictError).existingId).toBe(existing.id);
    // The local field is untouched, so the editor can still offer to swap it for the library one.
    const unchanged = await prisma.embeddedData.findUnique({ where: { id: fieldId } });
    expect(unchanged).toMatchObject({ key: null, surveyId });
  });

  test("a field that is already shared cannot be promoted again", async () => {
    const { workspaceA } = await seed();
    const shared = await createSharedEmbeddedData(workspaceA, {
      key: "plan_tier",
      name: "Plan tier",
      source: "ingested",
    });

    await expect(promoteEmbeddedDataToShared(shared.id, workspaceA, { key: "tier" })).rejects.toThrow(
      ResourceNotFoundError
    );
  });
});

describe("deleting a library field (real Postgres)", () => {
  test("refused while a survey links it, allowed once unlinked", async () => {
    const { workspaceA, surveyId } = await seed();
    const shared = await createSharedEmbeddedData(workspaceA, {
      key: "plan_tier",
      name: "Plan tier",
      source: "ingested",
    });
    const link = await linkSharedField(workspaceA, surveyId, shared.id, "plan_tier");

    const error = await deleteSharedEmbeddedData(shared.id, workspaceA).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmbeddedDataInUseError);
    expect((error as EmbeddedDataInUseError).usage).toEqual([
      { id: surveyId, name: "Onboarding", status: "draft" },
    ]);
    // The refusal is what stands between the survey and a silent cascade, so the row must still exist.
    expect(await prisma.embeddedData.findUnique({ where: { id: shared.id } })).not.toBeNull();

    await prisma.surveyEmbeddedData.delete({ where: { id: link.id } });

    await expect(deleteSharedEmbeddedData(shared.id, workspaceA)).resolves.toMatchObject({ id: shared.id });
    expect(await prisma.embeddedData.findUnique({ where: { id: shared.id } })).toBeNull();
  });
});

describe("changing a field's data type (real Postgres)", () => {
  const seedLinkedFieldWithResponse = async () => {
    const { workspaceA, surveyId } = await seed();
    const shared = await createSharedEmbeddedData(workspaceA, {
      key: "plan_tier",
      name: "Plan tier",
      source: "ingested",
    });
    await linkSharedField(workspaceA, surveyId, shared.id, "plan_tier");
    await prisma.response.create({ data: { surveyId, data: { plan_tier: "pro" } } });

    return { workspaceA, surveyId, sharedId: shared.id };
  };

  test("refused while a linked survey holds a response, and names that survey", async () => {
    const { workspaceA, surveyId, sharedId } = await seedLinkedFieldWithResponse();

    const error = await updateSharedEmbeddedData(sharedId, workspaceA, { dataType: "number" }).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(EmbeddedDataInUseError);
    expect((error as EmbeddedDataInUseError).usage).toEqual([
      { id: surveyId, name: "Onboarding", status: "draft" },
    ]);
    expect(await prisma.embeddedData.findUnique({ where: { id: sharedId } })).toMatchObject({
      dataType: "string",
    });
  });

  test("allowed once the caller has acknowledged those responses", async () => {
    const { workspaceA, sharedId } = await seedLinkedFieldWithResponse();

    await expect(
      updateSharedEmbeddedData(
        sharedId,
        workspaceA,
        { dataType: "number" },
        { acknowledgeExistingResponses: true }
      )
    ).resolves.toMatchObject({ dataType: "number" });
  });

  test("a rename is never blocked by responses, only a type change is", async () => {
    const { workspaceA, sharedId } = await seedLinkedFieldWithResponse();

    await expect(updateSharedEmbeddedData(sharedId, workspaceA, { name: "Tier" })).resolves.toMatchObject({
      name: "Tier",
    });
  });
});

describe("workspace scoping (real Postgres)", () => {
  test("another workspace's field is simply not there, for every write", async () => {
    const { workspaceA, workspaceB, surveyId } = await seed();
    const shared = await createSharedEmbeddedData(workspaceA, {
      key: "plan_tier",
      name: "Plan tier",
      source: "ingested",
    });
    const { fieldId: localId } = await seedLocalField(workspaceA, surveyId);

    await expect(updateSharedEmbeddedData(shared.id, workspaceB, { name: "Tier" })).rejects.toThrow(
      ResourceNotFoundError
    );
    await expect(deleteSharedEmbeddedData(shared.id, workspaceB)).rejects.toThrow(ResourceNotFoundError);
    await expect(promoteEmbeddedDataToShared(localId, workspaceB, { key: "tier" })).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(await getSharedEmbeddedData(workspaceB)).toEqual([]);
    expect(await getEmbeddedDataUsage(shared.id, workspaceB)).toEqual([]);
  });
});
