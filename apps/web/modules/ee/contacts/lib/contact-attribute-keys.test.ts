import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  getContactAttributeKeys,
  updateContactAttributeKey,
} from "./contact-attribute-keys";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("react", () => ({ cache: (fn) => fn }));

const environmentId = "env-1";
const mockKeys = [
  { id: "id-1", key: "email", environmentId },
  { id: "id-2", key: "name", environmentId },
];

describe("getContactAttributeKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns attribute keys for environment", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(mockKeys);
    const result = await getContactAttributeKeys(environmentId);
    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({ where: { environmentId } });
    expect(result).toEqual(mockKeys);
  });

  test("returns empty array if none found", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);
    const result = await getContactAttributeKeys(environmentId);
    expect(result).toEqual([]);
  });
});

describe("getContactAttributeKeyById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the selected key fields when found", async () => {
    const id = "cak-1";
    const key = {
      id,
      environmentId,
      type: "custom",
      name: "Email",
      description: "Customer email",
    };
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(key);

    const result = await getContactAttributeKeyById(id);

    expect(prisma.contactAttributeKey.findUnique).toHaveBeenCalledWith({
      where: { id },
      select: { id: true, environmentId: true, type: true, name: true, description: true },
    });
    expect(result).toEqual(key);
  });

  test("returns null when not found", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(null);
    const result = await getContactAttributeKeyById("missing-id");
    expect(result).toBeNull();
  });
});

describe("createContactAttributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates a custom key with name fallback and null description", async () => {
    const data = { environmentId, key: "company" };
    const created = {
      id: "cak-2",
      key: data.key,
      name: data.key,
      description: null,
      environmentId,
      type: "custom",
    };
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(created);

    const result = await createContactAttributeKey(data);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: data.key,
        name: data.key,
        description: null,
        environmentId,
        type: "custom",
      },
    });
    expect(result).toEqual(created);
  });

  test("keeps empty string description (does not coalesce to null)", async () => {
    const data = { environmentId, key: "notes", description: "" };
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue({
      id: "cak-3",
      key: data.key,
      name: data.key,
      description: "",
      environmentId,
      type: "custom",
    });

    await createContactAttributeKey(data);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "",
        }),
      })
    );
  });

  test("throws DatabaseError on unique constraint violation", async () => {
    const err = Object.assign(new Error("Unique constraint failed"), {
      code: PrismaErrorType.UniqueConstraintViolation,
    });
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(err);

    await expect(createContactAttributeKey({ environmentId, key: "email" })).rejects.toThrow(DatabaseError);
    await expect(createContactAttributeKey({ environmentId, key: "email" })).rejects.toThrow(
      "Attribute key already exists"
    );
  });

  test("rethrows unknown prisma error codes", async () => {
    const err = Object.assign(new Error("Some prisma error"), { code: PrismaErrorType.RecordDoesNotExist });
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(err);

    try {
      await createContactAttributeKey({ environmentId, key: "x" });
      throw new Error("Expected createContactAttributeKey to throw");
    } catch (caught) {
      expect(caught).toBe(err);
    }
  });
});

describe("updateContactAttributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws ResourceNotFoundError when key does not exist", async () => {
    const id = "missing-id";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(null);

    await expect(updateContactAttributeKey(id, { name: "New" })).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.contactAttributeKey.update).not.toHaveBeenCalled();
  });

  test("throws OperationNotAllowedError when trying to update a default key", async () => {
    const id = "default-id";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue({ id, type: "default" });

    await expect(updateContactAttributeKey(id, { name: "New" })).rejects.toThrow(OperationNotAllowedError);
    expect(prisma.contactAttributeKey.update).not.toHaveBeenCalled();
  });

  test("updates a non-default key", async () => {
    const id = "custom-id";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue({ id, type: "custom" });
    const updated = { id, key: "email", environmentId, type: "custom", name: "Email", description: null };
    vi.mocked(prisma.contactAttributeKey.update).mockResolvedValue(updated);

    const result = await updateContactAttributeKey(id, { name: "Email", description: null });

    expect(prisma.contactAttributeKey.update).toHaveBeenCalledWith({
      where: { id },
      data: { name: "Email", description: null },
    });
    expect(result).toEqual(updated);
  });
});

describe("deleteContactAttributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws ResourceNotFoundError when key does not exist", async () => {
    const id = "missing-id";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(null);

    await expect(deleteContactAttributeKey(id)).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.contactAttributeKey.delete).not.toHaveBeenCalled();
  });

  test("throws OperationNotAllowedError when trying to delete a default key", async () => {
    const id = "default-id";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue({ id, type: "default" });

    await expect(deleteContactAttributeKey(id)).rejects.toThrow(OperationNotAllowedError);
    expect(prisma.contactAttributeKey.delete).not.toHaveBeenCalled();
  });

  test("deletes a non-default key", async () => {
    const id = "custom-id";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue({ id, type: "custom" });
    const deleted = { id, key: "email", environmentId, type: "custom", name: "Email", description: null };
    vi.mocked(prisma.contactAttributeKey.delete).mockResolvedValue(deleted);

    const result = await deleteContactAttributeKey(id);

    expect(prisma.contactAttributeKey.delete).toHaveBeenCalledWith({ where: { id } });
    expect(result).toEqual(deleted);
  });
});
