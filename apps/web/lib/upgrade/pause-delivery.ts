import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { processAuthzedOutboxBatch } from "@/lib/authzed/outbox-processor";
import { env } from "@/lib/env";
import { ONLINE_UPGRADE_RELEASE } from "./compatibility";

type Checkpoint = { phase: string; queuePausedAt: Date | null; queueResumedAt: Date | null } | null;
type Dependencies = {
  read: () => Promise<Checkpoint>;
  deliver: () => Promise<unknown>;
  onError: () => void;
};

/** This runs outside BullMQ: pausing jobs must not pause permission revocations. */
export const createPauseDeliveryLoop = (deps: Dependencies) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> = Promise.resolve();
  const tick = () => {
    running = (async () => {
      try {
        const state = await deps.read();
        if (state?.phase === "complete" && state.queueResumedAt) {
          stopped = true;
          return;
        }
        if (state?.queuePausedAt && !state.queueResumedAt) await deps.deliver();
      } catch {
        deps.onError();
      } finally {
        if (!stopped) {
          timer = setTimeout(tick, 1000);
          timer.unref();
        }
      }
    })();
  };
  tick();
  return {
    close: async () => {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
};

const shared = globalThis as typeof globalThis & {
  formbricksOnlinePauseDelivery?: ReturnType<typeof createPauseDeliveryLoop>;
};

export const registerOnlinePauseDelivery = () => {
  if (env.FORMBRICKS_UPGRADE_MODE !== "online" || shared.formbricksOnlinePauseDelivery) return;
  shared.formbricksOnlinePauseDelivery = createPauseDeliveryLoop({
    read: () =>
      prisma.onlineUpgradeState.findUnique({
        where: { release: ONLINE_UPGRADE_RELEASE },
        select: { phase: true, queuePausedAt: true, queueResumedAt: true },
      }),
    deliver: () => processAuthzedOutboxBatch(),
    onError: () =>
      logger.error(
        { code: "online_pause_delivery_failed" },
        "Online upgrade authorization delivery will retry"
      ),
  });
};
