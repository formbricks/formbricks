import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getWebhookCountBySource } from "./webhook";

// Mock dependencies
vi.mock("@/lib/cache/webhook", () => ({
  webhookCache: {
    tag: {
      byEnvironmentIdAndSource: vi.fn((envId, source) => `webhook_${envId}_${source ?? "all"}`),
    },
  },
}));
vi.mock("@/lib/utils/validate");
vi.mock("@formbricks/database", () => ({
  prisma: {
    webhook: {
      count: vi.fn(),
    },
  },
}));

const environmentId = "test-environment-id";
const sourceZapier = "zapier";

describe("getWebhookCountBySource", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return webhook count for a specific source", async () => {
    const mockCount = 5;
    vi.mocked(prisma.webhook.count).mockResolvedValue(mockCount);

    const count = await getWebhookCountBySource(environmentId, sourceZapier);

    expect(count).toBe(mockCount);
    expect(validateInputs).toHaveBeenCalledWith(
      [environmentId, expect.any(Object)],
      [sourceZapier, expect.any(Object)]
    );
    expect(prisma.webhook.count).toHaveBeenCalledWith({
      where: {
        environmentId,
        source: sourceZapier,
      },
    });
  });

  test("should return total webhook count when source is undefined", async () => {
    const mockCount = 10;
    vi.mocked(prisma.webhook.count).mockResolvedValue(mockCount);

    const count = await getWebhookCountBySource(environmentId);

    expect(count).toBe(mockCount);
    expect(validateInputs).toHaveBeenCalledWith(
      [environmentId, expect.any(Object)],
      [undefined, expect.any(Object)]
    );
    expect(prisma.webhook.count).toHaveBeenCalledWith({
      where: {
        environmentId,
        source: undefined,
      },
    });
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.webhook.count).mockRejectedValue(prismaError);

    await expect(getWebhookCountBySource(environmentId, sourceZapier)).rejects.toThrow(DatabaseError);
    expect(prisma.webhook.count).toHaveBeenCalledTimes(1);
  });

  test("should throw original error on other errors", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(prisma.webhook.count).mockRejectedValue(genericError);

    await expect(getWebhookCountBySource(environmentId)).rejects.toThrow(genericError);
    expect(prisma.webhook.count).toHaveBeenCalledTimes(1);
  });
});
