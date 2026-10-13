import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";
import { getJobsWorkerBootstrapConfig } from "@/lib/jobs/config";
import { ONLINE_UPGRADE_RELEASE } from "@/lib/upgrade/compatibility";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = globalThis as typeof globalThis & {
    formbricksServerLifecycle?: { draining: boolean };
    formbricksJobsRuntime?: unknown;
  };
  try {
    if (runtime.formbricksServerLifecycle?.draining) throw new Error("draining");
    if (getJobsWorkerBootstrapConfig().enabled && !runtime.formbricksJobsRuntime) {
      throw new Error("worker_starting");
    }
    if (env.FORMBRICKS_UPGRADE_MODE === "online") {
      const state = await prisma.onlineUpgradeState.findUnique({
        where: { release: ONLINE_UPGRADE_RELEASE },
        select: { completedPhases: true },
      });
      if (!state?.completedPhases.includes("prepare")) throw new Error("preparation_incomplete");
    }
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "not_ready" }, { status: 503 });
  }
}
