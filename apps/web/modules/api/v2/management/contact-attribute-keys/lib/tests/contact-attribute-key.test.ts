import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import {
  TContactAttributeKeyInput,
  TGetContactAttributeKeysFilter,
} from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { ContactAttributeKey, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { createContactAttributeKey, getContactAttributeKeys } from "../contact-attribute-key";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    contactAttributeKey: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/cache/contact-attribute-key", () => ({
  contactAttributeKeyCache: {
    revalidate: vi.fn(),
    tag: {
      byEnvironmentId: vi.fn(),
    },
  },
}));

describe("getContactAttributeKeys", () => {
  const environmentIds = ["env1", "env2"];
  const params: TGetContactAttributeKeysFilter = {
    limit: 10,
    skip: 0,
    order: "asc",
    sortBy: "createdAt",
  };
  const fakeContactAttributeKeys = [
    { id: "key1", environmentId: "env1", name: "Key One", key: "keyOne" },
    { id: "key2", environmentId: "env1", name: "Key Two", key: "keyTwo" },
  ];
  const count = fakeContactAttributeKeys.length;

  it("returns ok response with contact attribute keys and meta", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([fakeContactAttributeKeys, count]);

    const result = await getContactAttributeKeys(environmentIds, params);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.data).toEqual(fakeContactAttributeKeys);
      expect(result.data.meta).toEqual({
        total: count,
        limit: params.limit,
        offset: params.skip,
      });
    }
  });

  it("returns error when prisma.$transaction throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("Test error"));

    const result = await getContactAttributeKeys(environmentIds, params);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toEqual("internal_server_error");
    }
  });
});

describe("createContactAttributeKey", () => {
  const inputContactAttributeKey: TContactAttributeKeyInput = {
    environmentId: "env1",
    name: "New Contact Attribute Key",
    key: "newKey",
    description: "Description for new key",
  };

  const createdContactAttributeKey: ContactAttributeKey = {
    id: "key100",
    environmentId: inputContactAttributeKey.environmentId,
    name: inputContactAttributeKey.name,
    key: inputContactAttributeKey.key,
    description: inputContactAttributeKey.description,
    isUnique: false,
    type: "custom",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("creates a contact attribute key and revalidates cache", async () => {
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValueOnce(createdContactAttributeKey);

    const result = await createContactAttributeKey(inputContactAttributeKey);
    expect(prisma.contactAttributeKey.create).toHaveBeenCalled();
    expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({
      environmentId: createdContactAttributeKey.environmentId,
      key: createdContactAttributeKey.key,
    });
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(createdContactAttributeKey);
    }
  });

  it("returns error when creation fails", async () => {
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValueOnce(new Error("Creation failed"));

    const result = await createContactAttributeKey(inputContactAttributeKey);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toEqual("internal_server_error");
    }
  });

  it("returns conflict error when key already exists", async () => {
    const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
      code: PrismaErrorType.UniqueConstraintViolation,
      clientVersion: "0.0.1",
    });
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValueOnce(errToThrow);

    const result = await createContactAttributeKey(inputContactAttributeKey);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "conflict",
        details: [
          {
            field: "contactAttributeKey",
            issue: 'Contact attribute key with "newKey" already exists',
          },
        ],
      });
    }
  });

  it("returns not found error when related record does not exist", async () => {
    const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error message", {
      code: PrismaErrorType.RelatedRecordDoesNotExist,
      clientVersion: "0.0.1",
    });
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValueOnce(errToThrow);

    const result = await createContactAttributeKey(inputContactAttributeKey);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "not_found",
        details: [
          {
            field: "contactAttributeKey",
            issue: "not found",
          },
        ],
      });
    }
  });
});
