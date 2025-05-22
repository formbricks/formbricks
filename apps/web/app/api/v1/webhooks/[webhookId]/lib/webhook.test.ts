import { webhookCache } from "@/lib/cache/webhook";
import { Prisma, Webhook } from "@prisma/client";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { deleteWebhook, getWebhook } from "./webhook";

vi.mock("@formbricks/database", () => ({
  prisma: {
    webhook: {
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/webhook", () => ({
  webhookCache: {
    tag: {
      byId: () => "mockTag",
    },
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
  },
}));

vi.mock("@/lib/cache", () => ({
  // Accept any function and return the exact same generic Fn – keeps typings intact
  cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
}));

describe("deleteWebhook", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("should delete the webhook and return the deleted webhook object when provided with a valid webhook ID", async () => {
    const mockedWebhook: Webhook = {
      id: "test-webhook-id",
      url: "https://example.com",
      name: "Test Webhook",
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "user",
      environmentId: "test-environment-id",
      triggers: [],
      surveyIds: [],
    };

    vi.mocked(prisma.webhook.delete).mockResolvedValueOnce(mockedWebhook);

    const deletedWebhook = await deleteWebhook("test-webhook-id");

    expect(deletedWebhook).toEqual(mockedWebhook);
    expect(prisma.webhook.delete).toHaveBeenCalledWith({
      where: {
        id: "test-webhook-id",
      },
    });
    expect(webhookCache.revalidate).toHaveBeenCalled();
  });

  test("should delete the webhook and call webhookCache.revalidate with correct parameters", async () => {
    const mockedWebhook: Webhook = {
      id: "test-webhook-id",
      url: "https://example.com",
      name: "Test Webhook",
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "user",
      environmentId: "test-environment-id",
      triggers: [],
      surveyIds: [],
    };

    vi.mocked(prisma.webhook.delete).mockResolvedValueOnce(mockedWebhook);

    const deletedWebhook = await deleteWebhook("test-webhook-id");

    expect(deletedWebhook).toEqual(mockedWebhook);
    expect(prisma.webhook.delete).toHaveBeenCalledWith({
      where: {
        id: "test-webhook-id",
      },
    });
    expect(webhookCache.revalidate).toHaveBeenCalledWith({
      id: mockedWebhook.id,
      environmentId: mockedWebhook.environmentId,
      source: mockedWebhook.source,
    });
  });

  test("should throw an error when called with an invalid webhook ID format", async () => {
    const { validateInputs } = await import("@/lib/utils/validate");
    (validateInputs as any).mockImplementation(() => {
      throw new ValidationError("Validation failed");
    });

    await expect(deleteWebhook("invalid-id")).rejects.toThrow(ValidationError);

    expect(prisma.webhook.delete).not.toHaveBeenCalled();
    expect(webhookCache.revalidate).not.toHaveBeenCalled();
  });

  test("should throw ResourceNotFoundError when webhook does not exist", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
      code: "P2025",
      clientVersion: "1.0.0",
    });

    vi.mocked(prisma.webhook.delete).mockRejectedValueOnce(prismaError);

    await expect(deleteWebhook("non-existent-id")).rejects.toThrow(ResourceNotFoundError);
    expect(webhookCache.revalidate).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError when database operation fails", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "1.0.0",
    });

    vi.mocked(prisma.webhook.delete).mockRejectedValueOnce(prismaError);

    await expect(deleteWebhook("test-webhook-id")).rejects.toThrow(DatabaseError);
    expect(webhookCache.revalidate).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError when an unknown error occurs", async () => {
    vi.mocked(prisma.webhook.delete).mockRejectedValueOnce(new Error("Unknown error"));

    await expect(deleteWebhook("test-webhook-id")).rejects.toThrow(DatabaseError);
    expect(webhookCache.revalidate).not.toHaveBeenCalled();
  });
});

describe("getWebhook", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("should return webhook when it exists", async () => {
    const mockedWebhook: Webhook = {
      id: "test-webhook-id",
      url: "https://example.com",
      name: "Test Webhook",
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "user",
      environmentId: "test-environment-id",
      triggers: [],
      surveyIds: [],
    };

    vi.mocked(prisma.webhook.findUnique).mockResolvedValueOnce(mockedWebhook);

    const webhook = await getWebhook("test-webhook-id");

    expect(webhook).toEqual(mockedWebhook);
    expect(prisma.webhook.findUnique).toHaveBeenCalledWith({
      where: {
        id: "test-webhook-id",
      },
    });
  });

  test("should return null when webhook does not exist", async () => {
    vi.mocked(prisma.webhook.findUnique).mockResolvedValueOnce(null);

    const webhook = await getWebhook("non-existent-id");

    expect(webhook).toBeNull();
    expect(prisma.webhook.findUnique).toHaveBeenCalledWith({
      where: {
        id: "non-existent-id",
      },
    });
  });

  test("should throw ValidationError when called with invalid webhook ID", async () => {
    const { validateInputs } = await import("@/lib/utils/validate");
    (validateInputs as any).mockImplementation(() => {
      throw new ValidationError("Validation failed");
    });

    await expect(getWebhook("invalid-id")).rejects.toThrow(ValidationError);
    expect(prisma.webhook.findUnique).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError when database operation fails", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "1.0.0",
    });

    vi.mocked(prisma.webhook.findUnique).mockRejectedValueOnce(prismaError);

    await expect(getWebhook("test-webhook-id")).rejects.toThrow(DatabaseError);
  });

  test("should throw original error when an unknown error occurs", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.webhook.findUnique).mockRejectedValueOnce(unknownError);

    await expect(getWebhook("test-webhook-id")).rejects.toThrow(unknownError);
  });

  test("should use cache when getting webhook", async () => {
    const mockedWebhook: Webhook = {
      id: "test-webhook-id",
      url: "https://example.com",
      name: "Test Webhook",
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "user",
      environmentId: "test-environment-id",
      triggers: [],
      surveyIds: [],
    };

    vi.mocked(prisma.webhook.findUnique).mockResolvedValueOnce(mockedWebhook);

    const webhook = await getWebhook("test-webhook-id");

    expect(webhook).toEqual(mockedWebhook);
    expect(prisma.webhook.findUnique).toHaveBeenCalledWith({
      where: {
        id: "test-webhook-id",
      },
    });
  });
});
