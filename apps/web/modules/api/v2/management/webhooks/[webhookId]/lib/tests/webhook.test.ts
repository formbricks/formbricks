import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { InvalidInputError } from "@formbricks/types/errors";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import {
  mockedPrismaWebhookUpdateReturn,
  prismaNotFoundError,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/tests/mocks/webhook.mock";
import { ZWebhookUpdateSchema } from "@/modules/api/v2/management/webhooks/[webhookId]/types/webhooks";
import { deleteWebhook, getWebhook, updateWebhook } from "../webhook";

vi.mock("@formbricks/database", () => ({
  prisma: {
    webhook: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateWebhookUrl: vi.fn().mockResolvedValue(undefined),
}));

describe("getWebhook", () => {
  test("returns ok if webhook is found", async () => {
    vi.mocked(prisma.webhook.findUnique).mockResolvedValueOnce({ id: "123" } as Awaited<
      ReturnType<typeof prisma.webhook.findUnique>
    >);
    const result = await getWebhook("123");
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual({ id: "123" });
    }
  });

  test("returns err if webhook not found", async () => {
    vi.mocked(prisma.webhook.findUnique).mockResolvedValueOnce(null);
    const result = await getWebhook("999");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string })?.type).toBe("not_found");
    }
  });

  test("returns err on Prisma error", async () => {
    vi.mocked(prisma.webhook.findUnique).mockRejectedValueOnce(new Error("DB error"));
    const result = await getWebhook("error");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string }).type).toBe("internal_server_error");
    }
  });
});

describe("updateWebhook", () => {
  const mockedWebhookUpdateReturn = { url: "https://example.com" } as z.infer<typeof ZWebhookUpdateSchema>;

  test("returns ok on successful update", async () => {
    vi.mocked(prisma.webhook.update).mockResolvedValueOnce(mockedPrismaWebhookUpdateReturn);
    const result = await updateWebhook("123", mockedWebhookUpdateReturn);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(mockedPrismaWebhookUpdateReturn);
    }
  });

  test("calls validateWebhookUrl when URL is provided", async () => {
    vi.mocked(prisma.webhook.update).mockResolvedValueOnce(mockedPrismaWebhookUpdateReturn);

    await updateWebhook("123", mockedWebhookUpdateReturn);

    expect(validateWebhookUrl).toHaveBeenCalledWith("https://example.com");
  });

  test("returns bad_request and skips Prisma update when URL fails SSRF validation", async () => {
    vi.mocked(validateWebhookUrl).mockRejectedValueOnce(
      new InvalidInputError("Webhook URL must not point to private or internal IP addresses")
    );

    const result = await updateWebhook("123", mockedWebhookUpdateReturn);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string }).type).toBe("bad_request");
      expect((result.error as { type: string; details: { field: string }[] }).details[0].field).toBe("url");
    }

    expect(prisma.webhook.update).not.toHaveBeenCalled();
  });

  test("returns internal_server_error when validateWebhookUrl throws an unexpected error", async () => {
    vi.mocked(validateWebhookUrl).mockRejectedValueOnce(new Error("unexpected DNS failure"));

    const result = await updateWebhook("123", mockedWebhookUpdateReturn);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string }).type).toBe("internal_server_error");
      expect((result.error as { type: string; details: { field: string }[] }).details[0].field).toBe("url");
    }

    expect(prisma.webhook.update).not.toHaveBeenCalled();
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.webhook.update).mockRejectedValueOnce(prismaNotFoundError);
    const result = await updateWebhook("999", mockedWebhookUpdateReturn);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string })?.type).toBe("not_found");
    }
  });

  test("returns internal_server_error if other error occurs", async () => {
    vi.mocked(prisma.webhook.update).mockRejectedValueOnce(new Error("Unknown error"));
    const result = await updateWebhook("abc", mockedWebhookUpdateReturn);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string })?.type).toBe("internal_server_error");
    }
  });
});

describe("deleteWebhook", () => {
  test("returns ok on successful delete", async () => {
    vi.mocked(prisma.webhook.delete).mockResolvedValueOnce(mockedPrismaWebhookUpdateReturn);
    const result = await deleteWebhook("123");
    expect(result.ok).toBe(true);
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.webhook.delete).mockRejectedValueOnce(prismaNotFoundError);
    const result = await deleteWebhook("999");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string })?.type).toBe("not_found");
    }
  });

  test("returns internal_server_error on other errors", async () => {
    vi.mocked(prisma.webhook.delete).mockRejectedValueOnce(new Error("Delete error"));
    const result = await deleteWebhook("abc");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect((result.error as { type: string })?.type).toBe("internal_server_error");
    }
  });
});
