import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ContactAttributeKey } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  getContactAttributeKeys,
  getContactAttributeKeysOfDirectory,
  updateContactAttributeKey,
} from "./contact-attribute-keys";
import { ContactDirectoryMissingError, requireWorkspaceContactDirectory } from "./contact-directory";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));
vi.mock("./contact-directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./contact-directory")>()),
  requireWorkspaceContactDirectory: vi.fn(),
}));

const workspaceId = "workspace-1";
/** The keys a workspace sees: every key of its directory, never filtered on `key.workspaceId`. */
const directoryScope = { directory: { workspaces: { some: { id: workspaceId } } } };

describe("getContactAttributeKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A directory's default keys have no workspace, and in a shared directory a key keeps the workspace
  // that created it: both are listed, under the caller's workspace.
  test("returns every key of the workspace's directory, reported under the caller's workspace", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { id: "id-1", key: "email" },
      { id: "id-2", key: "plan" },
    ] as unknown as ContactAttributeKey[]);

    const result = await getContactAttributeKeys(workspaceId);

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: directoryScope,
      select: expect.not.objectContaining({ directoryId: true, workspaceId: true }),
    });
    expect(result).toEqual([
      { id: "id-1", key: "email", workspaceId },
      { id: "id-2", key: "plan", workspaceId },
    ]);
  });

  test("returns empty array if none found", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);
    const result = await getContactAttributeKeys(workspaceId);
    expect(result).toEqual([]);
  });
});

describe("getContactAttributeKeysOfDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A directory's default keys have no workspace, and in a shared directory a key keeps the workspace
  // that created it; both are keys of every workspace on the directory.
  test("returns every key of the directory, whatever workspace it came from", async () => {
    const keys = [
      { id: "id-1", key: "userId", dataType: "string" },
      { id: "id-2", key: "plan", dataType: "string" },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(
      keys as unknown as ContactAttributeKey[]
    );

    const result = await getContactAttributeKeysOfDirectory("directory-1");

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { directoryId: "directory-1" },
      select: { id: true, key: true, dataType: true },
    });
    expect(result).toEqual(keys);
  });
});

describe("getContactAttributeKeyById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns a key of the workspace's directory, under the caller's workspace", async () => {
    const id = "cak-1";
    const key = { id, type: "custom", name: "Email", description: "Customer email" };
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue(key as unknown as ContactAttributeKey);

    const result = await getContactAttributeKeyById(id, workspaceId);

    expect(prisma.contactAttributeKey.findFirst).toHaveBeenCalledWith({
      where: { id, ...directoryScope },
      select: { id: true, type: true, name: true, description: true },
    });
    expect(result).toEqual({ ...key, workspaceId });
  });

  test("returns null for a key outside the workspace's directory", async () => {
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue(null);
    const result = await getContactAttributeKeyById("foreign-id", workspaceId);
    expect(result).toBeNull();
  });
});

describe("createContactAttributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWorkspaceContactDirectory).mockResolvedValue({
      id: "directory-1",
      matchingKey: "email",
    });
  });

  test("creates a custom key in the workspace's directory, with the workspace as its origin", async () => {
    const data = { workspaceId, key: "company" };
    const created = { id: "cak-2", key: data.key, name: "Company", description: null, type: "custom" };
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(created as unknown as ContactAttributeKey);

    const result = await createContactAttributeKey(data);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: data.key,
        name: "Company",
        description: null,
        directoryId: "directory-1",
        workspaceId,
        type: "custom",
      },
      select: expect.not.objectContaining({ directoryId: true }),
    });
    expect(result).toEqual({ ...created, workspaceId });
  });

  test("creates nothing for a workspace with no directory", async () => {
    vi.mocked(requireWorkspaceContactDirectory).mockRejectedValue(new ContactDirectoryMissingError());

    await expect(createContactAttributeKey({ workspaceId, key: "company" })).rejects.toThrow(
      ContactDirectoryMissingError
    );
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();
  });

  test("keeps empty string description (does not coalesce to null)", async () => {
    const data = { workspaceId, key: "notes", description: "" };
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue({
      id: "cak-3",
      key: data.key,
      name: data.key,
      description: "",
      type: "custom",
    } as unknown as ContactAttributeKey);

    await createContactAttributeKey(data);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "",
        }),
      })
    );
  });

  test("throws InvalidInputError on unique constraint violation", async () => {
    const err = Object.assign(new Error("Unique constraint failed"), {
      code: PrismaErrorType.UniqueConstraintViolation,
    });
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(err);

    await expect(createContactAttributeKey({ workspaceId, key: "email" })).rejects.toThrow(InvalidInputError);
  });

  test("throws InvalidInputError when key is reserved for future defaults", async () => {
    await expect(createContactAttributeKey({ workspaceId, key: "user_id" })).rejects.toThrow(
      InvalidInputError
    );
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();
  });

  test("rethrows unknown prisma error codes", async () => {
    const err = Object.assign(new Error("Some prisma error"), {
      code: "P2016", // a Prisma code the service does not handle → must be rethrown as-is
    });
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(err);

    try {
      await createContactAttributeKey({ workspaceId, key: "x" });
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

  test("throws ResourceNotFoundError for a key outside the workspace's directory", async () => {
    const id = "foreign-id";
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue(null);

    await expect(updateContactAttributeKey(id, workspaceId, { name: "New" })).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(prisma.contactAttributeKey.findFirst).toHaveBeenCalledWith({
      where: { id, ...directoryScope },
      select: { type: true },
    });
    expect(prisma.contactAttributeKey.update).not.toHaveBeenCalled();
  });

  test("throws OperationNotAllowedError when trying to update a default key", async () => {
    const id = "default-id";
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue({
      type: "default",
    } as unknown as ContactAttributeKey);

    await expect(updateContactAttributeKey(id, workspaceId, { name: "New" })).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(prisma.contactAttributeKey.update).not.toHaveBeenCalled();
  });

  test("updates a non-default key", async () => {
    const id = "custom-id";
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue({
      type: "custom",
    } as unknown as ContactAttributeKey);
    const updated = { id, key: "email", type: "custom", name: "Email", description: null };
    vi.mocked(prisma.contactAttributeKey.update).mockResolvedValue(updated as unknown as ContactAttributeKey);

    const result = await updateContactAttributeKey(id, workspaceId, {
      name: "Email",
      description: undefined,
    });

    expect(prisma.contactAttributeKey.update).toHaveBeenCalledWith({
      where: { id },
      data: { name: "Email", description: undefined },
      select: expect.any(Object),
    });
    expect(result).toEqual({ ...updated, workspaceId });
  });
});

describe("deleteContactAttributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws ResourceNotFoundError for a key outside the workspace's directory", async () => {
    const id = "foreign-id";
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue(null);

    await expect(deleteContactAttributeKey(id, workspaceId)).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.contactAttributeKey.findFirst).toHaveBeenCalledWith({
      where: { id, ...directoryScope },
      select: { type: true },
    });
    expect(prisma.contactAttributeKey.delete).not.toHaveBeenCalled();
  });

  test("throws OperationNotAllowedError when trying to delete a default key", async () => {
    const id = "default-id";
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue({
      type: "default",
    } as unknown as ContactAttributeKey);

    await expect(deleteContactAttributeKey(id, workspaceId)).rejects.toThrow(OperationNotAllowedError);
    expect(prisma.contactAttributeKey.delete).not.toHaveBeenCalled();
  });

  test("deletes a non-default key", async () => {
    const id = "custom-id";
    vi.mocked(prisma.contactAttributeKey.findFirst).mockResolvedValue({
      type: "custom",
    } as unknown as ContactAttributeKey);
    const deleted = { id, key: "email", type: "custom", name: "Email", description: null };
    vi.mocked(prisma.contactAttributeKey.delete).mockResolvedValue(deleted as unknown as ContactAttributeKey);

    const result = await deleteContactAttributeKey(id, workspaceId);

    expect(prisma.contactAttributeKey.delete).toHaveBeenCalledWith({
      where: { id },
      select: expect.any(Object),
    });
    expect(result).toEqual({ ...deleted, workspaceId });
  });
});
