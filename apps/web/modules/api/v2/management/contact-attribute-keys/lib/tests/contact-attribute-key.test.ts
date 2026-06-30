import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ContactAttributeKey, Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import {
  TContactAttributeKeyInput,
  TGetContactAttributeKeysFilter,
} from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
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

describe("getContactAttributeKeys", () => {
  const workspaceIds = ["ws1", "ws2"];
  const params: TGetContactAttributeKeysFilter = {
    limit: 10,
    skip: 0,
    order: "asc",
    sortBy: "createdAt",
  };
  const fakeContactAttributeKeys = [
    { id: "key1", workspaceId: "ws1", name: "Key One", key: "keyOne" },
    { id: "key2", workspaceId: "ws1", name: "Key Two", key: "keyTwo" },
  ];
  const count = fakeContactAttributeKeys.length;

  test("returns ok response with contact attribute keys and meta", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([fakeContactAttributeKeys, count]);

    const result = await getContactAttributeKeys(workspaceIds, params);
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

  test("returns error when prisma.$transaction throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("Test error"));

    const result = await getContactAttributeKeys(workspaceIds, params);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string })?.type).toEqual("internal_server_error");
    }
  });
});

describe("createContactAttributeKey", () => {
  const inputContactAttributeKey: TContactAttributeKeyInput = {
    workspaceId: "workspace-1",
    name: "New Contact Attribute Key",
    key: "newKey",
    description: "Description for new key",
  };

  const createdContactAttributeKey: ContactAttributeKey = {
    id: "key100",
    workspaceId: inputContactAttributeKey.workspaceId,
    name: inputContactAttributeKey.name,
    key: inputContactAttributeKey.key,
    description: inputContactAttributeKey.description,
    isUnique: false,
    type: "custom",
    dataType: "string",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test("creates a contact attribute key and revalidates cache", async () => {
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValueOnce(createdContactAttributeKey);

    const result = await createContactAttributeKey(inputContactAttributeKey);
    expect(prisma.contactAttributeKey.create).toHaveBeenCalled();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(createdContactAttributeKey);
    }
  });

  test("returns error when creation fails", async () => {
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValueOnce(new Error("Creation failed"));

    const result = await createContactAttributeKey(inputContactAttributeKey);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toEqual("internal_server_error");
    }
  });

  test("returns bad request when key is reserved for future defaults", async () => {
    const result = await createContactAttributeKey({
      ...inputContactAttributeKey,
      key: "user_id",
    });
    expect(result.ok).toBe(false);
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "bad_request",
        details: [
          {
            field: "key",
            issue:
              "Reserved attribute key(s): user_id. These keys are reserved for the v5.1 safe-identifier default attribute migration and cannot be created as custom attributes.",
          },
        ],
      });
    }
  });

  test("returns conflict error when key already exists", async () => {
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

  test("returns not found error when related record does not exist", async () => {
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
