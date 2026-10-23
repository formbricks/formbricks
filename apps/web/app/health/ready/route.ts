import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";
import { getJobsWorkerBootstrapConfig } from "@/lib/jobs/config";
import { ONLINE_UPGRADE_RELEASE } from "@/lib/upgrade/compatibility";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = globalThis as typeof globalThis & {
    formbricksServerLifecycle?: { draining: boolean };
    formbricksJobsRuntime?: unknown;
    formbricksOnlinePauseDelivery?: unknown;
  };
  try {
    if (runtime.formbricksServerLifecycle?.draining) throw new Error("draining");
    if (getJobsWorkerBootstrapConfig().enabled && !runtime.formbricksJobsRuntime) {
      throw new Error("worker_starting");
    }
    if (env.FORMBRICKS_UPGRADE_MODE === "online") {
      if (!runtime.formbricksOnlinePauseDelivery) throw new Error("pause_delivery_starting");
      const state = await prisma.onlineUpgradeState.findUnique({
        where: { release: ONLINE_UPGRADE_RELEASE },
        select: { completedPhases: true },
      });
      if (!state?.completedPhases.includes("prepare")) throw new Error("preparation_incomplete");
    }
    // This constraint arbitrates concurrent bootstrap sign-ups, including maintenance installs.
    const [index] = await prisma.$queryRaw<{ ready: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
        WHERE i.relnamespace = current_schema()::regnamespace
          AND i.relname = 'User_isBootstrapAdmin_key' AND x.indisvalid AND x.indisunique
      ) AS ready
    `;
    if (!index?.ready) throw new Error("bootstrap_constraint_missing");
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "not_ready" }, { status: 503 });
  }
}
