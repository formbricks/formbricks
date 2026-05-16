import IORedis, { type RedisOptions } from "ioredis";
import { logger } from "@formbricks/logger";

export interface JobsConnectionConfig {
  redisUrl: string;
  connectionName?: string;
}

const getCommonConnectionOptions = (
  connectionName?: string
): Pick<RedisOptions, "connectionName" | "lazyConnect" | "enableReadyCheck" | "connectTimeout"> => ({
  connectionName,
  lazyConnect: false,
  enableReadyCheck: true,
  connectTimeout: 3000,
});

const addConnectionErrorLogging = (connection: IORedis, label: string): IORedis => {
  connection.on("error", (error) => {
    logger.error({ err: error, label }, "BullMQ Redis connection error");
  });

  return connection;
};

export const createProducerConnection = ({
  redisUrl,
  connectionName = "formbricks-jobs-producer",
}: JobsConnectionConfig): IORedis =>
  addConnectionErrorLogging(
    new IORedis(redisUrl, {
      ...getCommonConnectionOptions(connectionName),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    }),
    "producer"
  );

export const createWorkerConnection = ({
  redisUrl,
  connectionName = "formbricks-jobs-worker",
}: JobsConnectionConfig): IORedis =>
  addConnectionErrorLogging(
    new IORedis(redisUrl, {
      ...getCommonConnectionOptions(connectionName),
      maxRetriesPerRequest: null,
    }),
    "worker"
  );

export const getRedisUrlFromEnv = (): string => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required for BullMQ");
  }

  if (!URL.canParse(redisUrl)) {
    throw new Error("REDIS_URL must be a valid URL for BullMQ");
  }

  return redisUrl;
};

export const closeRedisConnection = async (connection: IORedis): Promise<void> => {
  if (connection.status === "end") {
    return;
  }

  if (connection.status !== "ready") {
    connection.disconnect();
    return;
  }

  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
};
