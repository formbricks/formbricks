import { captureTelemetry } from "@/lib/telemetry";
import { TGetWebhooksFilter, TWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { WebhookSource } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { createWebhook, getWebhooks } from "../webhook";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    webhook: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telemetry", () => ({
  captureTelemetry: vi.fn(),
}));

describe("getWebhooks", () => {
  const environmentId = "env1";
  const params = {
    limit: 10,
    skip: 0,
  };
  const fakeWebhooks = [
    { id: "w1", environmentId, name: "Webhook One" },
    { id: "w2", environmentId, name: "Webhook Two" },
  ];
  const count = fakeWebhooks.length;

  test("returns ok response with webhooks and meta", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([fakeWebhooks, count]);

    const result = await getWebhooks(environmentId, params as TGetWebhooksFilter);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.data).toEqual(fakeWebhooks);
      expect(result.data.meta).toEqual({
        total: count,
        limit: params.limit,
        offset: params.skip,
      });
    }
  });

  test("returns error when prisma.$transaction throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("Test error"));

    const result = await getWebhooks(environmentId, params as TGetWebhooksFilter);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toEqual("internal_server_error");
    }
  });
});

describe("createWebhook", () => {
  const inputWebhook = {
    environmentId: "env1",
    name: "New Webhook",
    url: "http://example.com",
    source: "user" as WebhookSource,
    triggers: ["trigger1"],
    surveyIds: ["s1", "s2"],
  } as unknown as TWebhookInput;

  const createdWebhook = {
    id: "w100",
    environmentId: inputWebhook.environmentId,
    name: inputWebhook.name,
    url: inputWebhook.url,
    source: inputWebhook.source,
    triggers: inputWebhook.triggers,
    surveyIds: inputWebhook.surveyIds,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test("creates a webhook", async () => {
    vi.mocked(prisma.webhook.create).mockResolvedValueOnce(createdWebhook);

    const result = await createWebhook(inputWebhook);
    expect(captureTelemetry).toHaveBeenCalledWith("webhook_created");
    expect(prisma.webhook.create).toHaveBeenCalled();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(createdWebhook);
    }
  });

  test("returns error when creation fails", async () => {
    vi.mocked(prisma.webhook.create).mockRejectedValueOnce(new Error("Creation failed"));

    const result = await createWebhook(inputWebhook);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toEqual("internal_server_error");
    }
  });
});
