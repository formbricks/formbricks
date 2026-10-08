import "server-only";
import { prisma } from "@formbricks/database";
import { IS_SMTP_CONFIGURED } from "@/lib/constants";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import type { TRetentionHealthFacts } from "./health";

/** The facts `getRetentionHealthIssues` judges, for one organisation. Three indexed reads. */
export async function getRetentionHealthFacts(organizationId: string): Promise<TRetentionHealthFacts> {
  const [enabledPolicies, lastRun, oldestCleanup] = await Promise.all([
    prisma.retentionPolicy.findMany({
      where: { organizationId, enabled: true },
      select: { enabledAt: true },
    }),
    prisma.retentionRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    prisma.deletionCleanup.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    jobsConfigured: getJobsQueueingConfig().enabled,
    smtpConfigured: IS_SMTP_CONFIGURED,
    enabledPolicies,
    lastRunAt: lastRun?.startedAt ?? null,
    oldestCleanupAt: oldestCleanup?.createdAt ?? null,
  };
}
