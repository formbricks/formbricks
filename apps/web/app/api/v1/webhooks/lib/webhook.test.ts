import { createWebhook } from "@/app/api/v1/webhooks/lib/webhook";
import { TWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { webhookCache } from "@/lib/cache/webhook";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma, WebhookSource } from "@prisma/client";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";

vi.mock("@formbricks/database", () => ({
  prisma: {
    webhook: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/webhook", () => ({
  webhookCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("createWebhook", () => {
  afterEach(() => {
    cleanup();
  });

  test("should create a webhook and revalidate the cache when provided with valid input data", async () => {
    const webhookInput: TWebhookInput = {
      environmentId: "test-env-id",
      name: "Test Webhook",
      url: "https://example.com",
      source: "user",
      triggers: ["responseCreated"],
      surveyIds: ["survey1", "survey2"],
    };

    const createdWebhook = {
      id: "webhook-id",
      environmentId: "test-env-id",
      name: "Test Webhook",
      url: "https://example.com",
      source: "user" as WebhookSource,
      triggers: ["responseCreated"],
      surveyIds: ["survey1", "survey2"],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    vi.mocked(prisma.webhook.create).mockResolvedValueOnce(createdWebhook);

    const result = await createWebhook(webhookInput);

    expect(validateInputs).toHaveBeenCalled();

    expect(prisma.webhook.create).toHaveBeenCalledWith({
      data: {
        url: webhookInput.url,
        name: webhookInput.name,
        source: webhookInput.source,
        surveyIds: webhookInput.surveyIds,
        triggers: webhookInput.triggers,
        environment: {
          connect: {
            id: webhookInput.environmentId,
          },
        },
      },
    });

    expect(webhookCache.revalidate).toHaveBeenCalledWith({
      id: createdWebhook.id,
      environmentId: createdWebhook.environmentId,
      source: createdWebhook.source,
    });

    expect(result).toEqual(createdWebhook);
  });

  test("should throw a ValidationError if the input data does not match the ZWebhookInput schema", async () => {
    const invalidWebhookInput = {
      environmentId: "test-env-id",
      name: "Test Webhook",
      url: 123, // Invalid URL
      source: "user" as WebhookSource,
      triggers: ["responseCreated"],
      surveyIds: ["survey1", "survey2"],
    };

    vi.mocked(validateInputs).mockImplementation(() => {
      throw new ValidationError("Validation failed");
    });

    await expect(createWebhook(invalidWebhookInput as any)).rejects.toThrowError(ValidationError);
  });

  test("should throw a DatabaseError if a PrismaClientKnownRequestError occurs", async () => {
    const webhookInput: TWebhookInput = {
      environmentId: "test-env-id",
      name: "Test Webhook",
      url: "https://example.com",
      source: "user",
      triggers: ["responseCreated"],
      surveyIds: ["survey1", "survey2"],
    };

    vi.mocked(prisma.webhook.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "5.0.0",
      })
    );

    await expect(createWebhook(webhookInput)).rejects.toThrowError(DatabaseError);
  });

  test("should call webhookCache.revalidate with the correct parameters after successfully creating a webhook", async () => {
    const webhookInput: TWebhookInput = {
      environmentId: "env-id",
      name: "Test Webhook",
      url: "https://example.com",
      source: "user",
      triggers: ["responseCreated"],
      surveyIds: ["survey1"],
    };

    const createdWebhook = {
      id: "webhook123",
      environmentId: "env-id",
      name: "Test Webhook",
      url: "https://example.com",
      source: "user",
      triggers: ["responseCreated"],
      surveyIds: ["survey1"],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    vi.mocked(prisma.webhook.create).mockResolvedValueOnce(createdWebhook);

    await createWebhook(webhookInput);

    expect(webhookCache.revalidate).toHaveBeenCalledWith({
      id: createdWebhook.id,
      environmentId: createdWebhook.environmentId,
      source: createdWebhook.source,
    });
  });

  test("should throw a DatabaseError when provided with invalid surveyIds", async () => {
    const webhookInput: TWebhookInput = {
      environmentId: "test-env-id",
      name: "Test Webhook",
      url: "https://example.com",
      source: "user",
      triggers: ["responseCreated"],
      surveyIds: ["invalid-survey-id"],
    };

    vi.mocked(prisma.webhook.create).mockRejectedValueOnce(new Error("Foreign key constraint violation"));

    await expect(createWebhook(webhookInput)).rejects.toThrowError(DatabaseError);
  });

  test("should handle edge case URLs that are technically valid but problematic", async () => {
    const webhookInput: TWebhookInput = {
      environmentId: "test-env-id",
      name: "Test Webhook",
      url: "http://localhost:3000", // Example of a potentially problematic URL
      source: "user",
      triggers: ["responseCreated"],
      surveyIds: ["survey1", "survey2"],
    };

    vi.mocked(prisma.webhook.create).mockRejectedValueOnce(new DatabaseError("Invalid URL"));

    await expect(createWebhook(webhookInput)).rejects.toThrowError(DatabaseError);

    expect(validateInputs).toHaveBeenCalled();
    expect(prisma.webhook.create).toHaveBeenCalledWith({
      data: {
        url: webhookInput.url,
        name: webhookInput.name,
        source: webhookInput.source,
        surveyIds: webhookInput.surveyIds,
        triggers: webhookInput.triggers,
        environment: {
          connect: {
            id: webhookInput.environmentId,
          },
        },
      },
    });

    expect(webhookCache.revalidate).not.toHaveBeenCalled();
  });
});
