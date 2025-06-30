import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { TContactAttributeKeyCreateInput } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";
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
    const mockEnvironmentIds = ["env1", "env2"];
    const mockAttributeKeys = [
      {
        id: "key1",
        environmentId: "env1",
        name: "Key One",
        key: "keyOne",
        type: "custom" as TContactAttributeKeyType,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        isUnique: false,
      },
      {
        id: "key2",
        environmentId: "env2",
        name: "Key Two",
        key: "keyTwo",
        type: "custom" as TContactAttributeKeyType,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        isUnique: false,
      },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(mockAttributeKeys);

    const result = await getContactAttributeKeys(mockEnvironmentIds);

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { environmentId: { in: mockEnvironmentIds } },
    });
    expect(result).toEqual(mockAttributeKeys);
  });

  test("should throw DatabaseError if Prisma call fails", async () => {
    const mockEnvironmentIds = ["env1"];
    const errorMessage = "Prisma error";
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P1000", clientVersion: "test" })
    );

    await expect(getContactAttributeKeys(mockEnvironmentIds)).rejects.toThrow(DatabaseError);
  });

  test("should throw generic error if non-Prisma error occurs", async () => {
    const mockEnvironmentIds = ["env1"];
    const errorMessage = "Some other error";

    const errToThrow = new Prisma.PrismaClientKnownRequestError(errorMessage, {
      clientVersion: "0.0.1",
      code: PrismaErrorType.UniqueConstraintViolation,
    });
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValue(errToThrow);
    await expect(getContactAttributeKeys(mockEnvironmentIds)).rejects.toThrow(errorMessage);
  });
});

describe("createContactAttributeKey", () => {
  const environmentId = "testEnvId";
  const key = "testKey";
  const type: TContactAttributeKeyType = "custom";
  const mockCreatedAttributeKey = {
    id: "newKeyId",
    environmentId,
    name: key,
    key,
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
    isUnique: false,
    description: null,
  };

  const createInput: TContactAttributeKeyCreateInput = {
    key,
    type,
    environmentId,
    name: key,
    description: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should create and return a new contact attribute key", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey);

    const result = await createContactAttributeKey(environmentId, createInput);

    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({ where: { environmentId } });
    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: createInput.key,
        name: createInput.name || createInput.key,
        type: createInput.type,
        description: createInput.description || "",
        environment: { connect: { id: environmentId } },
      },
    });
    expect(result).toEqual(mockCreatedAttributeKey);
  });

  test("should throw OperationNotAllowedError if max attribute classes reached", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT);

    await expect(createContactAttributeKey(environmentId, createInput)).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({ where: { environmentId } });
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError if Prisma create fails", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    const errorMessage = "Prisma create error";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P2000", clientVersion: "test" })
    );

    await expect(createContactAttributeKey(environmentId, createInput)).rejects.toThrow(DatabaseError);
    await expect(createContactAttributeKey(environmentId, createInput)).rejects.toThrow(errorMessage);
  });

  test("should throw generic error if non-Prisma error occurs during create", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    const errorMessage = "Some other create error";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(new Error(errorMessage));

    await expect(createContactAttributeKey(environmentId, createInput)).rejects.toThrow(Error);
    await expect(createContactAttributeKey(environmentId, createInput)).rejects.toThrow(errorMessage);
  });

  test("should use key as name when name is not provided", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey);

    const inputWithoutName: TContactAttributeKeyCreateInput = {
      key,
      type,
      environmentId,
      description: "",
    };

    await createContactAttributeKey(environmentId, inputWithoutName);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: inputWithoutName.key,
        name: inputWithoutName.key, // Should fall back to key when name is not provided
        type: inputWithoutName.type,
        description: inputWithoutName.description || "",
        environment: { connect: { id: environmentId } },
      },
    });
  });

  test("should use empty string for description when description is not provided", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(mockCreatedAttributeKey);

    const inputWithoutDescription: TContactAttributeKeyCreateInput = {
      key,
      type,
      environmentId,
      name: "Test Name",
    };

    await createContactAttributeKey(environmentId, inputWithoutDescription);

    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: inputWithoutDescription.key,
        name: inputWithoutDescription.name,
        type: inputWithoutDescription.type,
        description: "", // Should fall back to empty string when description is not provided
        environment: { connect: { id: environmentId } },
      },
    });
  });
});
