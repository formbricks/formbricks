import { REDIS_URL } from "@/lib/constants";
import { createClient } from "redis";
import { logger } from "@formbricks/logger";

const redis = REDIS_URL
  ? await createClient({ url: REDIS_URL })
      .on("error", (err) => logger.error("Error creating redis client", err))
      .connect()
  : null;

if (!REDIS_URL) {
  logger.warn("REDIS_URL is not set");
}

export default redis;
