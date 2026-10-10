import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { getRetentionHealthFacts } from "./health-service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    retentionPolicy: { findMany: vi.fn() },
    retentionRun: { findFirst: vi.fn() },
    deletionCleanup: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/jobs/config", () => ({ getJobsQueueingConfig: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  IS_SMTP_CONFIGURED: true,
}));

/** How the facts are judged is pinned in `health.test.ts`; these pin what is read, for one organisation. */
describe("getRetentionHealthFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("reads the enabled policies, the latest run and the oldest pending cleanup of the organisation", async () => {
    const enabledAt = new Date("2030-01-01T00:00:00.000Z");
    vi.mocked(getJobsQueueingConfig).mockReturnValue({ enabled: true } as never);
    vi.mocked(prisma.retentionPolicy.findMany).mockResolvedValue([{ enabledAt }] as never);
    vi.mocked(prisma.retentionRun.findFirst).mockResolvedValue({
      startedAt: new Date("2030-01-09"),
    } as never);
    vi.mocked(prisma.deletionCleanup.findFirst).mockResolvedValue({
      createdAt: new Date("2030-01-05"),
    } as never);

    await expect(getRetentionHealthFacts("clorg")).resolves.toEqual({
      jobsConfigured: true,
      smtpConfigured: true,
      enabledPolicies: [{ enabledAt }],
      lastRunAt: new Date("2030-01-09"),
      oldestCleanupAt: new Date("2030-01-05"),
    });
    expect(prisma.retentionPolicy.findMany).toHaveBeenCalledWith({
      where: { organizationId: "clorg", enabled: true },
      select: { enabledAt: true },
    });
    expect(prisma.retentionRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "clorg" }, orderBy: { startedAt: "desc" } })
    );
    expect(prisma.deletionCleanup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "clorg" }, orderBy: { createdAt: "asc" } })
    );
  });

  test("reports no run and no backlog for an organisation that has neither", async () => {
    vi.mocked(getJobsQueueingConfig).mockReturnValue({ enabled: false } as never);
    vi.mocked(prisma.retentionPolicy.findMany).mockResolvedValue([]);
    vi.mocked(prisma.retentionRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.deletionCleanup.findFirst).mockResolvedValue(null);

    await expect(getRetentionHealthFacts("clorg")).resolves.toMatchObject({
      jobsConfigured: false,
      lastRunAt: null,
      oldestCleanupAt: null,
    });
  });
});
