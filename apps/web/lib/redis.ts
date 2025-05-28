import { REDIS_URL } from "@/lib/constants";
import Redis from "ioredis";
import { logger } from "@formbricks/logger";

const redis = REDIS_URL ? new Redis(REDIS_URL) : null;

if (!redis) {
  logger.info("REDIS_URL is not set");
}

export default redis;
