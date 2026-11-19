import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  ANONYMOUS_OAUTH_CLIENT_RETENTION_MS,
  deleteStaleAnonymousOauthClients,
  processOauthClientCleanupJob,
} from "./oauth-client-cleanup";

vi.mock("@formbricks/database", () => ({
  prisma: { oauthClient: { findMany: vi.fn(), deleteMany: vi.fn() } },
}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn() } }));

const NOW = new Date("2026-11-16T12:00:00.000Z");
const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));

describe("deleteStaleAnonymousOauthClients (ENG-7314)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("only ever targets anonymous clients past retention with no consent and no live token", async () => {
    vi.mocked(prisma.oauthClient.findMany).mockResolvedValue([]);

    await deleteStaleAnonymousOauthClients(NOW);

    expect(prisma.oauthClient.findMany).toHaveBeenCalledWith({
      where: {
        userId: null,
        referenceId: null,
        OR: [{ skipConsent: null }, { skipConsent: false }],
        createdAt: { lt: new Date(NOW.getTime() - ANONYMOUS_OAUTH_CLIENT_RETENTION_MS) },
        consents: { none: {} },
        mcpGrants: { none: {} },
        accessTokens: { none: { revoked: null, expiresAt: { gt: NOW } } },
        refreshTokens: { none: { revoked: null, expiresAt: { gt: NOW } } },
      },
      select: { id: true },
      take: 500,
    });
    expect(prisma.oauthClient.deleteMany).not.toHaveBeenCalled();
  });

  test("re-applies the same filter on the delete, so a client that gained a consent meanwhile survives", async () => {
    vi.mocked(prisma.oauthClient.findMany).mockResolvedValue(ids(2) as never);
    vi.mocked(prisma.oauthClient.deleteMany).mockResolvedValue({ count: 1 });

    await expect(deleteStaleAnonymousOauthClients(NOW)).resolves.toBe(1);

    const { where } = vi.mocked(prisma.oauthClient.deleteMany).mock.calls[0][0] as {
      where: { AND: Record<string, unknown>[] };
    };
    expect(where.AND[0]).toEqual({
      userId: null,
      referenceId: null,
      OR: [{ skipConsent: null }, { skipConsent: false }],
      createdAt: { lt: new Date(NOW.getTime() - ANONYMOUS_OAUTH_CLIENT_RETENTION_MS) },
      consents: { none: {} },
      mcpGrants: { none: {} },
      accessTokens: { none: { revoked: null, expiresAt: { gt: NOW } } },
      refreshTokens: { none: { revoked: null, expiresAt: { gt: NOW } } },
    });
    expect(where.AND[1]).toEqual({ id: { in: ["c0", "c1"] } });
  });

  test("drains a backlog batch by batch and stops on a short batch", async () => {
    vi.mocked(prisma.oauthClient.findMany)
      .mockResolvedValueOnce(ids(500) as never)
      .mockResolvedValueOnce(ids(3) as never);
    vi.mocked(prisma.oauthClient.deleteMany)
      .mockResolvedValueOnce({ count: 500 })
      .mockResolvedValueOnce({ count: 3 });

    await expect(deleteStaleAnonymousOauthClients(NOW)).resolves.toBe(503);
    expect(prisma.oauthClient.findMany).toHaveBeenCalledTimes(2);
  });

  test("the job logs only when it deleted something, and a failure fails the job", async () => {
    const context = { jobId: "j1", jobName: "oauth-client.cleanup" } as never;
    vi.mocked(prisma.oauthClient.findMany).mockResolvedValueOnce([]);
    await processOauthClientCleanupJob({ scope: "global" } as never, context);
    expect(logger.info).not.toHaveBeenCalled();

    vi.mocked(prisma.oauthClient.findMany).mockResolvedValueOnce(ids(1) as never);
    vi.mocked(prisma.oauthClient.deleteMany).mockResolvedValueOnce({ count: 1 });
    await processOauthClientCleanupJob({ scope: "global" } as never, context);
    expect(logger.info).toHaveBeenCalledWith(
      { jobId: "j1", jobName: "oauth-client.cleanup", scope: "global", deleted: 1 },
      "Stale anonymous OAuth clients deleted"
    );

    vi.mocked(prisma.oauthClient.findMany).mockRejectedValueOnce(new Error("db down"));
    await expect(processOauthClientCleanupJob({ scope: "global" } as never, context)).rejects.toThrow(
      "db down"
    );
  });
});
