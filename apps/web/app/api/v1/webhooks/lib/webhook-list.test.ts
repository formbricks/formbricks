import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getWebhooks } from "./webhook";

vi.mock("@formbricks/database", () => ({ prisma: { webhook: { findMany: vi.fn() } } }));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));

describe("v1 getWebhooks", () => {
  beforeEach(() => vi.clearAllMocks());

  test("always bounds the query and orders it for stable paging", async () => {
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([]);

    await getWebhooks(["ws1"], 250, 10);

    expect(prisma.webhook.findMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: ["ws1"] } },
      omit: { secret: true },
      orderBy: { id: "asc" },
      take: 250,
      skip: 10,
    });
  });
});
