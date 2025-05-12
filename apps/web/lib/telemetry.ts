/* We use this telemetry service to better understand how Formbricks is being used
   and how we can improve it. All data including the IP address is collected anonymously
   and we cannot trace anything back to you or your customers. If you still want to
   disable telemetry, set the environment variable TELEMETRY_DISABLED=1 */
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION } from "./constants";
import { env } from "./env";

const crypto = require("crypto");

// We are using the hashed CRON_SECRET as the distinct identifier for the instance for telemetry.
// The hash cannot be traced back to the original value or the instance itself.
// This is to ensure that the telemetry data is anonymous but still unique to the instance.
const getTelemetryId = (): string => {
  return crypto.createHash("sha256").update(env.CRON_SECRET).digest("hex");
};

export const captureTelemetry = async (eventName: string, properties = {}) => {
  if (env.TELEMETRY_DISABLED !== "1" && IS_PRODUCTION) {
    try {
      await fetch("https://telemetry.formbricks.com/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: "phc_SoIFUJ8b9ufDm0YOnoOxJf6PXyuHpO7N6RztxFdZTy", // NOSONAR // This is a public API key for telemetry and not a secret
          event: eventName,
          properties: {
            distinct_id: getTelemetryId(),
            ...properties,
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error(error, "error sending telemetry");
    }
  }
};
