import { REDIS_URL } from "@/lib/constants";
import { createClient } from "redis";
import { logger } from "@formbricks/logger";

if (!REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

const redis = await createClient({ url: REDIS_URL })
  .on("error", (err) => logger.error("Error creating redis client", err))
  .connect();

export default redis;
