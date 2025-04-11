import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { TContactAttributeKeyUpdateSchema } from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { ContactAttributeKey, Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "../contact-attribute-key";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/contact-attribute-key", () => ({
  contactAttributeKeyCache: {
    tag: {
      byId: () => "mockTag",
    },
    revalidate: vi.fn(),
  },
}));

// Mock data
const mockContactAttributeKey: ContactAttributeKey = {
  id: "cak123",
  key: "email",
  name: "Email",
  description: "User's email address",
  environmentId: "env123",
  isUnique: true,
  type: "default",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUpdateInput: TContactAttributeKeyUpdateSchema = {
  key: "email",
  name: "Email Address",
  description: "User's verified email address",
};

const prismaNotFoundError = new Prisma.PrismaClientKnownRequestError("Mock error message", {
  code: PrismaErrorType.RelatedRecordDoesNotExist,
  clientVersion: "0.0.1",
});

const prismaUniqueConstraintError = new Prisma.PrismaClientKnownRequestError("Mock error message", {
  code: PrismaErrorType.UniqueConstraintViolation,
  clientVersion: "0.0.1",
});

describe("getContactAttributeKey", () => {
  test("returns ok if contact attribute key is found", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValueOnce(mockContactAttributeKey);
    const result = await getContactAttributeKey("cak123");
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(mockContactAttributeKey);
    }
  });

  test("returns err if contact attribute key not found", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValueOnce(null);
    const result = await getContactAttributeKey("cak999");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "not_found",
        details: [{ field: "contactAttributeKey", issue: "not found" }],
      });
    }
  });

  test("returns err on Prisma error", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockRejectedValueOnce(new Error("DB error"));
    const result = await getContactAttributeKey("error");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "internal_server_error",
        details: [{ field: "contactAttributeKey", issue: "DB error" }],
      });
    }
  });
});

describe("updateContactAttributeKey", () => {
  test("returns ok on successful update", async () => {
    const updatedKey = { ...mockContactAttributeKey, ...mockUpdateInput };
    vi.mocked(prisma.contactAttributeKey.update).mockResolvedValueOnce(updatedKey);

    const result = await updateContactAttributeKey("cak123", mockUpdateInput);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(updatedKey);
    }

    expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({
      id: "cak123",
      environmentId: mockContactAttributeKey.environmentId,
      key: mockUpdateInput.key,
    });
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.contactAttributeKey.update).mockRejectedValueOnce(prismaNotFoundError);

    const result = await updateContactAttributeKey("cak999", mockUpdateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "not_found",
        details: [{ field: "contactAttributeKey", issue: "not found" }],
      });
    }
  });

  test("returns conflict error if key already exists", async () => {
    vi.mocked(prisma.contactAttributeKey.update).mockRejectedValueOnce(prismaUniqueConstraintError);

    const result = await updateContactAttributeKey("cak123", mockUpdateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "conflict",
        details: [
          { field: "contactAttributeKey", issue: 'Contact attribute key with "email" already exists' },
        ],
      });
    }
  });

  test("returns internal_server_error if other error occurs", async () => {
    vi.mocked(prisma.contactAttributeKey.update).mockRejectedValueOnce(new Error("Unknown error"));

    const result = await updateContactAttributeKey("cak123", mockUpdateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "internal_server_error",
        details: [{ field: "contactAttributeKey", issue: "Unknown error" }],
      });
    }
  });
});

describe("deleteContactAttributeKey", () => {
  test("returns ok on successful delete", async () => {
    vi.mocked(prisma.contactAttributeKey.delete).mockResolvedValueOnce(mockContactAttributeKey);

    const result = await deleteContactAttributeKey("cak123");
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(mockContactAttributeKey);
    }

    expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({
      id: "cak123",
      environmentId: mockContactAttributeKey.environmentId,
      key: mockContactAttributeKey.key,
    });
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.contactAttributeKey.delete).mockRejectedValueOnce(prismaNotFoundError);

    const result = await deleteContactAttributeKey("cak999");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "not_found",
        details: [{ field: "contactAttributeKey", issue: "not found" }],
      });
    }
  });

  test("returns internal_server_error on other errors", async () => {
    vi.mocked(prisma.contactAttributeKey.delete).mockRejectedValueOnce(new Error("Delete error"));

    const result = await deleteContactAttributeKey("cak123");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "internal_server_error",
        details: [{ field: "contactAttributeKey", issue: "Delete error" }],
      });
    }
  });
});
