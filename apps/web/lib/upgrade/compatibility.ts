import "server-only";
import { prisma } from "@formbricks/database";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { env } from "@/lib/env";

export const ONLINE_UPGRADE_RELEASE = "6.1";

/**
 * Activation only moves forward. Read from PostgreSQL so already-running surge pods observe it
 * without another deployment. A missing checkpoint in online mode never enables new producers.
 */
export const isNewReleaseWorkEnabled = async (): Promise<boolean> => {
  if (env.FORMBRICKS_UPGRADE_MODE !== "online") return true;
  const state = await prisma.onlineUpgradeState.findUnique({
    where: { release: ONLINE_UPGRADE_RELEASE },
    select: { activatedAt: true },
  });
  return state?.activatedAt != null;
};

export const assertNewReleaseWorkEnabled = async (): Promise<void> => {
  if (!(await isNewReleaseWorkEnabled())) {
    throw new OperationNotAllowedError("This change is unavailable until the online upgrade completes");
  }
};
