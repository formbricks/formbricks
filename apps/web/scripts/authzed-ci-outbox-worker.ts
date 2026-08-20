import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@formbricks/database";
import { closeAuthzedClient } from "@/lib/authzed/client";
import { processAuthzedProjectionDeliveryJob } from "@/lib/authzed/outbox-processor";

const DELIVERY_INTERVAL_MS = 100;
let stopped = false;

const stop = (): void => {
  stopped = true;
};

const main = async (): Promise<void> => {
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    while (!stopped) {
      await processAuthzedProjectionDeliveryJob();
      await delay(DELIVERY_INTERVAL_MS);
    }
  } catch {
    process.stderr.write("AuthZed CI outbox delivery failed\n");
    process.exitCode = 1;
  } finally {
    closeAuthzedClient();
    await prisma.$disconnect();
  }
};

void main();
