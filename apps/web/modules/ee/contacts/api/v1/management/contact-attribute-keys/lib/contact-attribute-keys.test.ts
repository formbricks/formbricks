import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { TContactAttributeKeyCreateInput } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { CONTACT_DIRECTORY_MISSING_MESSAGE } from "@/modules/ee/contacts/lib/contact-directory";
import { createContactAttributeKey, getContactAttributeKeys } from "./contact-attribute-keys";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    workspace: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate");
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

describe("getContactAttributeKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: "ws1", contactDirectoryId: "dir-1" },
    ] as never);
  });

  // Two of the key's workspaces on one directory see the same keys: each is listed once, under the
  // workspace with the lowest id, and a key's `directoryId` stays out of the response.
  test("lists each key of the key's directories once, under the caller's workspace", async () => {
    const createdAt = new Date("2024-01-01");
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: "ws1", contactDirectoryId: "dir-1" },
      { id: "ws2", contactDirectoryId: "dir-1" },
      { id: "ws3", contactDirectoryId: "dir-2" },
    ] as never);
    const keyColumns = {
      createdAt,
      updatedAt: createdAt,
      description: null,
      isUnique: false,
      type: "custom" as TContactAttributeKeyType,
      dataType: "string" as const,
    };
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { id: "key1", key: "keyOne", name: "Key One", directoryId: "dir-1", ...keyColumns },
      { id: "key2", key: "keyTwo", name: "Key Two", directoryId: "dir-2", ...keyColumns },
    ] as never);

    const result = await getContactAttributeKeys(["ws3", "ws2", "ws1"], 25, 50);

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { directoryId: { in: ["dir-1", "dir-2"] } },
      select: expect.objectContaining({ id: true, key: true, directoryId: true }),
      orderBy: { id: "asc" },
      take: 25,
      skip: 50,
    });
    expect(result).toStrictEqual([
      { id: "key1", key: "keyOne", name: "Key One", workspaceId: "ws1", ...keyColumns },
      { id: "key2", key: "keyTwo", name: "Key Two", workspaceId: "ws3", ...keyColumns },
    ]);
  });

  test("lists nothing when none of the workspaces has a directory", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

    await expect(getContactAttributeKeys(["ws1"], 25, 50)).resolves.toEqual([]);
    expect(prisma.contactAttributeKey.findMany).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError if Prisma call fails", async () => {
    const mockWorkspaceIds = ["ws1"];
    const errorMessage = "Prisma error";
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P1000", clientVersion: "test" })
    );

    await expect(getContactAttributeKeys(mockWorkspaceIds, 25, 50)).rejects.toThrow(DatabaseError);
  });

  test("should throw generic error if non-Prisma error occurs", async () => {
    const mockWorkspaceIds = ["ws1"];
    const errorMessage = "Some other error";

    const errToThrow = new Prisma.PrismaClientKnownRequestError(errorMessage, {
      clientVersion: "0.0.1",
      code: PrismaErrorType.UniqueConstraintViolation,
    });
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(errToThrow);
    await expect(getContactAttributeKeys(mockWorkspaceIds, 25, 50)).rejects.toThrow(errorMessage);
  });

  test("should re-throw non-Prisma errors", async () => {
    const mockWorkspaceIds = ["ws1"];
    const errorMessage = "boom";
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(new Error(errorMessage));
    await expect(getContactAttributeKeys(mockWorkspaceIds, 25, 50)).rejects.toThrow(errorMessage);
  });
});

describe("createContactAttributeKey", () => {
  const workspaceId = "testWorkspaceId";
  const key = "testKey";
  const type: TContactAttributeKeyType = "custom";
  const mockCreatedAttributeKey = {
    id: "newKeyId",
    workspaceId,
    name: key,
    key,
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
    isUnique: false,
    description: null,
    dataType: "string" as const,
  };

  const createInput: TContactAttributeKeyCreateInput = {
    key,
    type,
    workspaceId,
    name: key,
    description: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      contactDirectory: { id: "dir-1", matchingKey: "email" },
    } as never);
  });

  test("should create and return a new contact attribute key", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey as never);

    const result = await createContactAttributeKey(workspaceId, createInput);

    // The cap counts the directory's keys, and the key is created in the directory.
    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({
      where: { directoryId: "dir-1" },
    });
    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: createInput.key,
        name: createInput.name || createInput.key,
        type: createInput.type,
        description: createInput.description || "",
        directoryId: "dir-1",
        workspaceId,
      },
      select: expect.not.objectContaining({ directoryId: true }),
    });
    expect(result).toEqual(mockCreatedAttributeKey);
  });

  test("should throw OperationNotAllowedError if max attribute classes reached", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT);

    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({
      where: { directoryId: "dir-1" },
    });
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();
  });

  test("creates nothing for a workspace with no directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ contactDirectory: null } as never);

    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(
      CONTACT_DIRECTORY_MISSING_MESSAGE
    );
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();
  });

  test("should throw InvalidInputError when key is reserved for future defaults", async () => {
    await expect(
      createContactAttributeKey(workspaceId, {
        ...createInput,
        key: "user_id",
      })
    ).rejects.toThrow(InvalidInputError);
    expect(prisma.contactAttributeKey.count).not.toHaveBeenCalled();
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError if Prisma create fails", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    const errorMessage = "Prisma create error";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P2000", clientVersion: "test" })
    );

    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(DatabaseError);
    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(errorMessage);
  });

  test("should throw InvalidInputError when attribute key already exists (unique constraint)", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "test",
      })
    );

    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(InvalidInputError);
    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(
      "Attribute key already exists"
    );
  });

  test("should throw generic error if non-Prisma error occurs during create", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    const errorMessage = "Some other create error";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(new Error(errorMessage));

    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(Error);
    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(errorMessage);
  });

  test("should use key as name when name is not provided", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey as never);

    const inputWithoutName: TContactAttributeKeyCreateInput = {
      key,
      type,
      workspaceId,
      description: "",
    };

    await createContactAttributeKey(workspaceId, inputWithoutName);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: inputWithoutName.key,
        name: "TestKey", // formatSnakeCaseToTitleCase("testKey") capitalizes first letter
        type: inputWithoutName.type,
        description: inputWithoutName.description || "",
        directoryId: "dir-1",
        workspaceId,
      },
      select: expect.any(Object),
    });
  });

  test("should use empty string for description when description is not provided", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey as never);

    const inputWithoutDescription: TContactAttributeKeyCreateInput = {
      key,
      type,
      workspaceId,
      name: "Test Name",
    };

    await createContactAttributeKey(workspaceId, inputWithoutDescription);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: inputWithoutDescription.key,
        name: inputWithoutDescription.name,
        type: inputWithoutDescription.type,
        description: "", // Should fall back to empty string when description is not provided
        directoryId: "dir-1",
        workspaceId,
      },
      select: expect.any(Object),
    });
  });
});
