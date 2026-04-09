import "server-only";
import { logger } from "@formbricks/logger";
import { posthogServerClient } from "./server";

type PostHogEventProperties = Record<string, string | number | boolean | null | undefined>;

export function capturePostHogEvent(
  distinctId: string,
  eventName: string,
  properties?: PostHogEventProperties
): void {
  if (!posthogServerClient) return;

  try {
    posthogServerClient.capture({
      distinctId,
      event: eventName,
      properties: {
        ...properties,
        $lib: "posthog-node",
        source: "server",
      },
    });
  } catch (error) {
    logger.warn({ error, eventName }, "Failed to capture PostHog event");
  }
}
