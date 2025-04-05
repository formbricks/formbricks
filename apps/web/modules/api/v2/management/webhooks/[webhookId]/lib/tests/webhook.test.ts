import { webhookCache } from "@/lib/cache/webhook";
import {
  mockedPrismaWebhookUpdateReturn,
  prismaNotFoundError,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/tests/mocks/webhook.mock";
import { ZWebhookUpdateSchema } from "@/modules/api/v2/management/webhooks/[webhookId]/types/webhooks";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { prisma } from "@formbricks/database";
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

vi.mock("@/lib/cache/webhook", () => ({
  webhookCache: {
    tag: {
      byId: () => "mockTag",
    },
    revalidate: vi.fn(),
  },
}));

describe("getWebhook", () => {
  test("returns ok if webhook is found", async () => {
    vi.mocked(prisma.webhook.findUnique).mockResolvedValueOnce({ id: "123" });
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
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns err on Prisma error", async () => {
    vi.mocked(prisma.webhook.findUnique).mockRejectedValueOnce(new Error("DB error"));
    const result = await getWebhook("error");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toBe("internal_server_error");
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

    expect(webhookCache.revalidate).toHaveBeenCalled();
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.webhook.update).mockRejectedValueOnce(prismaNotFoundError);
    const result = await updateWebhook("999", mockedWebhookUpdateReturn);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns internal_server_error if other error occurs", async () => {
    vi.mocked(prisma.webhook.update).mockRejectedValueOnce(new Error("Unknown error"));
    const result = await updateWebhook("abc", mockedWebhookUpdateReturn);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("internal_server_error");
    }
  });
});

describe("deleteWebhook", () => {
  test("returns ok on successful delete", async () => {
    vi.mocked(prisma.webhook.delete).mockResolvedValueOnce(mockedPrismaWebhookUpdateReturn);
    const result = await deleteWebhook("123");
    expect(result.ok).toBe(true);
    expect(webhookCache.revalidate).toHaveBeenCalled();
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.webhook.delete).mockRejectedValueOnce(prismaNotFoundError);
    const result = await deleteWebhook("999");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns internal_server_error on other errors", async () => {
    vi.mocked(prisma.webhook.delete).mockRejectedValueOnce(new Error("Delete error"));
    const result = await deleteWebhook("abc");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("internal_server_error");
    }
  });
});
