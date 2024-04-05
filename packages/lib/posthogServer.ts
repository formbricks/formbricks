import { PostHog } from "posthog-node";

import { env } from "./env";

const enabled =
  process.env.NODE_ENV === "production" &&
  env.NEXT_PUBLIC_POSTHOG_API_HOST &&
  env.NEXT_PUBLIC_POSTHOG_API_KEY;

export const capturePosthogEnvironmentEvent = async (
  environmentId: string,
  eventName: string,
  properties: any = {}
) => {
  if (
    !enabled ||
    typeof env.NEXT_PUBLIC_POSTHOG_API_HOST !== "string" ||
    typeof env.NEXT_PUBLIC_POSTHOG_API_KEY !== "string"
  ) {
    return;
  }
  try {
    const client = new PostHog(env.NEXT_PUBLIC_POSTHOG_API_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_API_HOST,
    });
    client.capture({
      distinctId: environmentId,
      event: eventName,
      groups: { environment: environmentId },
      properties,
    });
    await client.shutdownAsync();
  } catch (error) {
    console.error("error sending posthog event:", error);
  }
};
