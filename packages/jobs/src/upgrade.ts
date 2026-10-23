import { closeRedisConnection, createProducerConnection } from "./connection";
import { createJobsQueue } from "./queue";

export type JobsUpgradeQueue = {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  isPaused: () => Promise<boolean>;
  active: () => Promise<number>;
  close: () => Promise<void>;
};

/** An independent producer connection; never starts a worker or changes job/scheduler payloads. */
export const openJobsUpgradeQueue = async (redisUrl: string, prefix?: string): Promise<JobsUpgradeQueue> => {
  const connection = createProducerConnection({ redisUrl, connectionName: "formbricks-online-upgrade" });
  const queue = createJobsQueue({ connection, prefix });
  const close = async () => {
    try {
      await queue.close();
    } finally {
      await closeRedisConnection(connection);
    }
  };
  try {
    await queue.waitUntilReady();
    return {
      pause: () => queue.pause(),
      resume: () => queue.resume(),
      isPaused: () => queue.isPaused(),
      active: () => queue.getActiveCount(),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
};
