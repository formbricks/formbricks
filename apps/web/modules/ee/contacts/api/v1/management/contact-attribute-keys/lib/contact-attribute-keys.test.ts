import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
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

vi.mock("@/lib/cache/contact-attribute-key", () => ({
  contactAttributeKeyCache: {
    tag: {
      byEnvironmentId: vi.fn((id) => `contactAttributeKey-environment-${id}`),
    },
    revalidate: vi.fn(),
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
      { id: "key1", environmentId: "env1", name: "Key One", key: "keyOne", type: "custom" },
      { id: "key2", environmentId: "env2", name: "Key Two", key: "keyTwo", type: "custom" },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(mockAttributeKeys);

    const result = await getContactAttributeKeys(mockEnvironmentIds);

    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: { environmentId: { in: mockEnvironmentIds } },
    });
    expect(result).toEqual(mockAttributeKeys);
    expect(contactAttributeKeyCache.tag.byEnvironmentId).toHaveBeenCalledTimes(mockEnvironmentIds.length);
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should create and return a new contact attribute key", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue({
      ...mockCreatedAttributeKey,
      description: null, // ensure description is explicitly null if that's the case
    });

    const result = await createContactAttributeKey(environmentId, key, type);

    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({ where: { environmentId } });
    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key,
        name: key,
        type,
        environment: { connect: { id: environmentId } },
      },
    });
    expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({
      id: mockCreatedAttributeKey.id,
      environmentId: mockCreatedAttributeKey.environmentId,
      key: mockCreatedAttributeKey.key,
    });
    expect(result).toEqual(mockCreatedAttributeKey);
  });

  test("should throw OperationNotAllowedError if max attribute classes reached", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT);

    await expect(createContactAttributeKey(environmentId, key, type)).rejects.toThrow(
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

    await expect(createContactAttributeKey(environmentId, key, type)).rejects.toThrow(DatabaseError);
    await expect(createContactAttributeKey(environmentId, key, type)).rejects.toThrow(errorMessage);
  });

  test("should throw generic error if non-Prisma error occurs during create", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(0);
    const errorMessage = "Some other create error";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(new Error(errorMessage));

    await expect(createContactAttributeKey(environmentId, key, type)).rejects.toThrow(Error);
    await expect(createContactAttributeKey(environmentId, key, type)).rejects.toThrow(errorMessage);
  });
});
