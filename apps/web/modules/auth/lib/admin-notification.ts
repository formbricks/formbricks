"use server";

import { CRON_SECRET } from "@formbricks/lib/constants";
import { getTelemetryId } from "@formbricks/lib/telemetry";

// Send admin account information to n8n webhook
export const notifyAdminCreation = async (email: string): Promise<void> => {
  try {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    // Get the instance ID (using telemetry ID function which hashes CRON_SECRET)
    const instanceId = getTelemetryId();

    // Send data to n8n webhook
    const response = await fetch(
      "https://n8n.formbricks.com/webhook-test/6a107551-e368-425f-81e7-05e680cf21e8",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CRON_SECRET,
        },
        body: JSON.stringify({
          email,
          instanceId,
          timestamp: new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      console.error(`Failed to notify admin creation: ${response.statusText}`);
    }
  } catch (error) {
    // Don't throw errors - just log them to avoid disrupting the signup flow
    console.error("Error notifying admin creation:", error);
    // We're intentionally not throwing here to prevent signup flow disruption
  }
};
