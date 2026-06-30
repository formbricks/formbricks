import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { TContactAttributeKeyCreateInput } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { createContactAttributeKey, getContactAttributeKeys } from "./contact-attribute-keys";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate");

describe("getContactAttributeKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return contact attribute keys when found", async () => {
    const mockWorkspaceIds = ["ws1", "ws2"];
    const mockAttributeKeys = [
      {
        id: "key1",
        workspaceId: "workspace1",
        name: "Key One",
        key: "keyOne",
        type: "custom" as TContactAttributeKeyType,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        isUnique: false,
        dataType: "string" as const,
      },
      {
        id: "key2",
        workspaceId: "workspace2",
        name: "Key Two",
        key: "keyTwo",
        type: "custom" as TContactAttributeKeyType,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        isUnique: false,
        dataType: "string" as const,
      },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(mockAttributeKeys);

    const result = await getContactAttributeKeys(mockWorkspaceIds);

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: mockWorkspaceIds } },
    });
    expect(result).toEqual(mockAttributeKeys);
  });

  test("should throw DatabaseError if Prisma call fails", async () => {
    const mockWorkspaceIds = ["ws1"];
    const errorMessage = "Prisma error";
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P1000", clientVersion: "test" })
    );

    await expect(getContactAttributeKeys(mockWorkspaceIds)).rejects.toThrow(DatabaseError);
  });

  test("should throw generic error if non-Prisma error occurs", async () => {
    const mockWorkspaceIds = ["ws1"];
    const errorMessage = "Some other error";

    const errToThrow = new Prisma.PrismaClientKnownRequestError(errorMessage, {
      clientVersion: "0.0.1",
      code: PrismaErrorType.UniqueConstraintViolation,
    });
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(errToThrow);
    await expect(getContactAttributeKeys(mockWorkspaceIds)).rejects.toThrow(errorMessage);
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
  });

  test("should create and return a new contact attribute key", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey);

    const result = await createContactAttributeKey(workspaceId, createInput);

    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({ where: { workspaceId } });
    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: createInput.key,
        name: createInput.name || createInput.key,
        type: createInput.type,
        description: createInput.description || "",
        workspaceId,
      },
    });
    expect(result).toEqual(mockCreatedAttributeKey);
  });

  test("should throw OperationNotAllowedError if max attribute classes reached", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT);

    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({ where: { workspaceId } });
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

  test("should throw generic error if non-Prisma error occurs during create", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    const errorMessage = "Some other create error";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(new Error(errorMessage));

    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(Error);
    await expect(createContactAttributeKey(workspaceId, createInput)).rejects.toThrow(errorMessage);
  });

  test("should use key as name when name is not provided", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey);

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
        workspaceId,
      },
    });
  });

  test("should use empty string for description when description is not provided", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey);

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
        workspaceId,
      },
    });
  });
});
