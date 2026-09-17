import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  EmbeddedDataInUseError,
  EmbeddedDataKeyConflictError,
  type TCreateSharedEmbeddedDataInput,
} from "../types";
import {
  createSharedEmbeddedData,
  deleteSharedEmbeddedData,
  getEmbeddedDataWorkspaceId,
  getSharedEmbeddedData,
  promoteEmbeddedDataToShared,
  updateSharedEmbeddedData,
} from "./library";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    embeddedData: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    surveyEmbeddedData: { findMany: vi.fn() },
    response: { findFirst: vi.fn() },
  },
}));
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

const workspaceId = "clww1234567890123456789012";
const fieldId = "clff1234567890123456789012";
const surveyId = "clss1234567890123456789012";

/** A stored shared row, as the select returns it. */
const sharedRow = {
  id: fieldId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  source: "ingested" as const,
  dataType: "string" as const,
  defaultValue: null,
  locked: false,
  surveyId: null,
  workspaceId,
};

const localRow = { ...sharedRow, key: null, surveyId };

const createInput: TCreateSharedEmbeddedDataInput = {
  key: "plan_tier",
  name: "Plan tier",
  source: "ingested",
};

const usageRow = { survey: { id: surveyId, name: "Onboarding", status: "inProgress" as const } };

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), {
    code: PrismaErrorType.UniqueConstraintViolation,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.surveyEmbeddedData.findMany).mockResolvedValue([]);
});

describe("getSharedEmbeddedData", () => {
  test("lists only rows with a library key, and reports how many surveys link each", async () => {
    vi.mocked(prisma.embeddedData.findMany).mockResolvedValue([
      { ...sharedRow, _count: { surveyLinks: 3 } },
    ] as never);

    const fields = await getSharedEmbeddedData(workspaceId);

    expect(fields).toEqual([{ ...sharedRow, surveyCount: 3 }]);
    // `key: { not: null }` is the whole definition of shared, so a local row must never reach the list.
    expect(prisma.embeddedData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId, key: { not: null } } })
    );
  });
});

describe("getEmbeddedDataWorkspaceId", () => {
  test("answers for a local row too, since promote starts from one", async () => {
    vi.mocked(prisma.embeddedData.findUnique).mockResolvedValue({ workspaceId } as never);

    await expect(getEmbeddedDataWorkspaceId(fieldId)).resolves.toBe(workspaceId);
    // Unscoped on purpose: this lookup is what establishes the scope everything else is checked against.
    expect(prisma.embeddedData.findUnique).toHaveBeenCalledWith({
      where: { id: fieldId },
      select: { workspaceId: true },
    });
  });

  test("answers null when no row has the id", async () => {
    vi.mocked(prisma.embeddedData.findUnique).mockResolvedValue(null as never);

    await expect(getEmbeddedDataWorkspaceId(fieldId)).resolves.toBeNull();
  });
});

describe("createSharedEmbeddedData", () => {
  test("stores a field with no owning survey", async () => {
    vi.mocked(prisma.embeddedData.create).mockResolvedValue(sharedRow as never);

    const field = await createSharedEmbeddedData(workspaceId, createInput);

    expect(field).toEqual(sharedRow);
    expect(prisma.embeddedData.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ surveyId: null, key: "plan_tier" }) })
    );
  });

  test("refuses a key outside the safe-identifier charset, with the schema's own message", async () => {
    await expect(createSharedEmbeddedData(workspaceId, { ...createInput, key: "Plan-Tier" })).rejects.toThrow(
      "Key must start with a lowercase letter and contain only a-z, 0-9 and _"
    );
    expect(prisma.embeddedData.create).not.toHaveBeenCalled();
  });

  test("refuses a reserved key, which ingestion would never fill", async () => {
    await expect(createSharedEmbeddedData(workspaceId, { ...createInput, key: "lang" })).rejects.toThrow(
      "Key is reserved"
    );
    expect(prisma.embeddedData.create).not.toHaveBeenCalled();
  });

  test("refuses a default value that disagrees with the declared data type", async () => {
    await expect(
      createSharedEmbeddedData(workspaceId, { ...createInput, dataType: "number", defaultValue: "seven" })
    ).rejects.toThrow("A number field's default value must be a number");
  });

  test("refuses locking anything but an ingested field", async () => {
    await expect(
      createSharedEmbeddedData(workspaceId, { ...createInput, source: "computed", locked: true })
    ).rejects.toThrow("Only ingested fields can be locked");
  });

  test("refuses a computed field typed boolean, which the logic engine cannot calculate", async () => {
    await expect(
      createSharedEmbeddedData(workspaceId, { ...createInput, source: "computed", dataType: "boolean" })
    ).rejects.toThrow("Computed fields support only string or number");
  });

  test("refuses a reserved source, which is a code catalog rather than a row", async () => {
    await expect(
      createSharedEmbeddedData(workspaceId, { ...createInput, source: "reserved" })
    ).rejects.toThrow("Reserved fields are a code catalog and are never stored as rows");
  });

  test("maps the unique violation on [workspaceId, key] to a key conflict", async () => {
    vi.mocked(prisma.embeddedData.create).mockRejectedValue(uniqueViolation());

    const error = await createSharedEmbeddedData(workspaceId, createInput).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmbeddedDataKeyConflictError);
    expect(error).toBeInstanceOf(InvalidInputError);
    // A plain create has no "use the existing one instead" offer to make, so it carries no id.
    expect((error as EmbeddedDataKeyConflictError).existingId).toBeNull();
  });

  test("rethrows a prisma error that is not the key conflict", async () => {
    vi.mocked(prisma.embeddedData.create).mockRejectedValue(
      Object.assign(new Error("boom"), { code: "P2003" })
    );

    await expect(createSharedEmbeddedData(workspaceId, createInput)).rejects.toThrow("boom");
  });
});

describe("updateSharedEmbeddedData", () => {
  test("writes the editable columns", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);
    vi.mocked(prisma.embeddedData.update).mockResolvedValue({ ...sharedRow, name: "Tier" } as never);

    const field = await updateSharedEmbeddedData(fieldId, workspaceId, { name: "Tier" });

    expect(field.name).toBe("Tier");
    expect(prisma.embeddedData.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: fieldId, workspaceId } })
    );
  });

  test("a row with no library key is not found here", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(null);

    await expect(updateSharedEmbeddedData(fieldId, workspaceId, { name: "Tier" })).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(prisma.embeddedData.update).not.toHaveBeenCalled();
  });

  test("re-checks the merged row, so a patch cannot reach a state a create would refuse", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);

    // The stored field is a string; the patch retypes it to number and leaves a string default behind.
    await expect(
      updateSharedEmbeddedData(fieldId, workspaceId, { dataType: "number", defaultValue: "seven" })
    ).rejects.toThrow("A number field's default value must be a number");
    expect(prisma.embeddedData.update).not.toHaveBeenCalled();
  });

  test("refuses a data-type change once a linked survey has a response, naming the surveys", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);
    vi.mocked(prisma.surveyEmbeddedData.findMany)
      .mockResolvedValueOnce([{ surveyId }] as never)
      .mockResolvedValueOnce([usageRow] as never);
    vi.mocked(prisma.response.findFirst).mockResolvedValue({ id: "clrr1234567890123456789012" } as never);

    const error = await updateSharedEmbeddedData(fieldId, workspaceId, { dataType: "number" }).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(EmbeddedDataInUseError);
    expect((error as EmbeddedDataInUseError).usage).toEqual([usageRow.survey]);
    expect(prisma.embeddedData.update).not.toHaveBeenCalled();
  });

  test("allows the same data-type change once the caller has acknowledged the responses", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);
    vi.mocked(prisma.embeddedData.update).mockResolvedValue({ ...sharedRow, dataType: "number" } as never);

    const field = await updateSharedEmbeddedData(
      fieldId,
      workspaceId,
      { dataType: "number" },
      { acknowledgeExistingResponses: true }
    );

    expect(field.dataType).toBe("number");
    // The acknowledgement is what skips the guard, so nothing should have been counted.
    expect(prisma.response.findFirst).not.toHaveBeenCalled();
  });

  test("allows a data-type change while no linked survey holds a response", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);
    vi.mocked(prisma.surveyEmbeddedData.findMany).mockResolvedValue([{ surveyId }] as never);
    vi.mocked(prisma.response.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.embeddedData.update).mockResolvedValue({ ...sharedRow, dataType: "number" } as never);

    await expect(
      updateSharedEmbeddedData(fieldId, workspaceId, { dataType: "number" })
    ).resolves.toMatchObject({ dataType: "number" });
  });

  test("does not run the response guard when the patch re-declares the current data type", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);
    vi.mocked(prisma.embeddedData.update).mockResolvedValue(sharedRow as never);

    await updateSharedEmbeddedData(fieldId, workspaceId, { dataType: "string", name: "Tier" });

    // Re-sending the same type is not a change, so a field with responses stays renameable.
    expect(prisma.response.findFirst).not.toHaveBeenCalled();
  });
});

describe("deleteSharedEmbeddedData", () => {
  test("removes a field nothing links", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);

    const field = await deleteSharedEmbeddedData(fieldId, workspaceId);

    expect(field).toEqual(sharedRow);
    expect(prisma.embeddedData.delete).toHaveBeenCalledWith({ where: { id: fieldId, workspaceId } });
  });

  test("refuses while a survey links it, and says which", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(sharedRow as never);
    vi.mocked(prisma.surveyEmbeddedData.findMany).mockResolvedValue([usageRow] as never);

    const error = await deleteSharedEmbeddedData(fieldId, workspaceId).catch((e: unknown) => e);

    // The cascade on SurveyEmbeddedData would otherwise strip the field from every linked survey.
    expect(error).toBeInstanceOf(EmbeddedDataInUseError);
    expect((error as EmbeddedDataInUseError).usage).toEqual([usageRow.survey]);
    expect(prisma.embeddedData.delete).not.toHaveBeenCalled();
  });
});

describe("promoteEmbeddedDataToShared", () => {
  test("sets the key and clears the owning survey in one update, touching nothing else", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(localRow as never);
    vi.mocked(prisma.embeddedData.update).mockResolvedValue(sharedRow as never);

    const field = await promoteEmbeddedDataToShared(fieldId, workspaceId, { key: "plan_tier" });

    expect(field).toEqual(sharedRow);
    // The survey's link and its storageKey live on SurveyEmbeddedData, which promote never writes.
    // `surveyId: { not: null }` in the predicate is what makes the write a compare-and-set against
    // the state the read checked, rather than a blind overwrite a second promote could race.
    expect(prisma.embeddedData.update).toHaveBeenCalledWith({
      where: { id: fieldId, workspaceId, surveyId: { not: null } },
      data: { key: "plan_tier", description: null, surveyId: null },
      select: expect.anything(),
    });
  });

  test("answers a row promoted out from under it the same way it answers a missing one", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(localRow as never);
    vi.mocked(prisma.embeddedData.update).mockRejectedValue(
      Object.assign(new Error("Record to update not found"), { code: PrismaErrorType.RecordNotFound })
    );

    await expect(promoteEmbeddedDataToShared(fieldId, workspaceId, { key: "plan_tier" })).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  test("refuses a field that is already shared, or lives in another workspace", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(null);

    await expect(promoteEmbeddedDataToShared(fieldId, workspaceId, { key: "plan_tier" })).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(prisma.embeddedData.update).not.toHaveBeenCalled();
  });

  test("refuses a reserved key before touching the row", async () => {
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(localRow as never);

    await expect(promoteEmbeddedDataToShared(fieldId, workspaceId, { key: "lang" })).rejects.toThrow(
      "Key is reserved"
    );
    expect(prisma.embeddedData.update).not.toHaveBeenCalled();
  });

  test("answers a taken key with the id of the row already holding it", async () => {
    const existingSharedId = "clee1234567890123456789012";
    vi.mocked(prisma.embeddedData.findFirst).mockResolvedValue(localRow as never);
    vi.mocked(prisma.embeddedData.update).mockRejectedValue(uniqueViolation());
    vi.mocked(prisma.embeddedData.findUnique).mockResolvedValue({ id: existingSharedId } as never);

    const error = await promoteEmbeddedDataToShared(fieldId, workspaceId, { key: "plan_tier" }).catch(
      (e: unknown) => e
    );

    // The editor offers "use the library field instead", which needs the library row's id.
    expect(error).toBeInstanceOf(EmbeddedDataKeyConflictError);
    expect((error as EmbeddedDataKeyConflictError).existingId).toBe(existingSharedId);
  });
});
