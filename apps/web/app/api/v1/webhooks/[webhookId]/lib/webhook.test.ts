import { webhookCache } from "@/lib/cache/webhook";
import { Webhook } from "@prisma/client";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ValidationError } from "@formbricks/types/errors";
import { deleteWebhook } from "./webhook";

vi.mock("@formbricks/database", () => ({
  prisma: {
    webhook: {
      delete: vi.fn(),
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

describe("deleteWebhook", () => {
  afterEach(() => {
    cleanup();
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
});
