import { WebhookSource } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError } from "@formbricks/types/errors";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { TGetWebhooksFilter, TWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
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

vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateWebhookUrl: vi.fn().mockResolvedValue(undefined),
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
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([fakeWebhooks, count] as [
      typeof fakeWebhooks,
      number,
    ]);

    const result = await getWebhooks([environmentId], params as TGetWebhooksFilter);
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

    const result = await getWebhooks([environmentId], params as TGetWebhooksFilter);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string })?.type).toEqual("internal_server_error");
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
    secret: null,
  };

  test("creates a webhook", async () => {
    vi.mocked(prisma.webhook.create).mockResolvedValueOnce(createdWebhook);

    const result = await createWebhook(inputWebhook);
    expect(prisma.webhook.create).toHaveBeenCalled();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(createdWebhook);
    }
  });

  test("calls validateWebhookUrl with the provided URL", async () => {
    vi.mocked(prisma.webhook.create).mockResolvedValueOnce(createdWebhook);

    await createWebhook(inputWebhook);

    expect(validateWebhookUrl).toHaveBeenCalledWith("http://example.com");
  });

  test("returns bad_request and skips Prisma create when URL fails SSRF validation", async () => {
    vi.mocked(validateWebhookUrl).mockRejectedValueOnce(
      new InvalidInputError("Webhook URL must not point to private or internal IP addresses")
    );

    const result = await createWebhook(inputWebhook);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string }).type).toEqual("bad_request");
      expect((result.error as { type: string; details: { field: string }[] }).details[0].field).toEqual(
        "url"
      );
    }

    expect(prisma.webhook.create).not.toHaveBeenCalled();
  });

  test("returns internal_server_error when validateWebhookUrl throws an unexpected error", async () => {
    vi.mocked(validateWebhookUrl).mockRejectedValueOnce(new Error("unexpected DNS failure"));

    const result = await createWebhook(inputWebhook);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string }).type).toEqual("internal_server_error");
      expect((result.error as { type: string; details: { field: string }[] }).details[0].field).toEqual(
        "url"
      );
    }

    expect(prisma.webhook.create).not.toHaveBeenCalled();
  });

  test("returns error when creation fails", async () => {
    vi.mocked(prisma.webhook.create).mockRejectedValueOnce(new Error("Creation failed"));

    const result = await createWebhook(inputWebhook);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string }).type).toEqual("internal_server_error");
    }
  });
});
