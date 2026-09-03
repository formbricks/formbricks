import "server-only";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@formbricks/database";
import { closeAuthzedClient } from "@/lib/authzed/client";
import { processAuthzedProjectionDeliveryJob } from "@/lib/authzed/outbox-processor";
import { runAuthzedCiOutboxWorker } from "./authzed-ci-outbox-worker-runner";

const DELIVERY_INTERVAL_MS = 100;
const MAX_CONSECUTIVE_FAILURES = 5;
const heartbeatPath = process.env.AUTHZED_CI_OUTBOX_HEARTBEAT_PATH;
let stopped = false;

const stop = (): void => {
  stopped = true;
};

const main = async (): Promise<void> => {
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    if (!heartbeatPath) {
      throw new Error("AuthZed CI outbox heartbeat path is required");
    }

    await runAuthzedCiOutboxWorker({
      deliver: processAuthzedProjectionDeliveryJob,
      heartbeat: async () => writeFile(heartbeatPath, String(Date.now()), { mode: 0o600 }),
      maxConsecutiveFailures: MAX_CONSECUTIVE_FAILURES,
      onUnexpectedFailure: (consecutiveFailures) => {
        process.stderr.write(
          `AuthZed CI outbox delivery encountered an unexpected failure (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})\n`
        );
      },
      shouldStop: () => stopped,
      wait: async () => delay(DELIVERY_INTERVAL_MS),
    });
  } catch {
    process.stderr.write("AuthZed CI outbox delivery failed\n");
    process.exitCode = 1;
  } finally {
    closeAuthzedClient();
    await prisma.$disconnect();
  }
};

void main();
