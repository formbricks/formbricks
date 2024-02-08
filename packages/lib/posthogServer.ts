import { PostHog } from "posthog-node";

const enabled =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_POSTHOG_API_HOST &&
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY;

export const capturePosthogEnvironmentEvent = async (
  environmentId: string,
  eventName: string,
  properties: any = {}
) => {
  if (
    !enabled ||
    typeof process.env.NEXT_PUBLIC_POSTHOG_API_HOST !== "string" ||
    typeof process.env.NEXT_PUBLIC_POSTHOG_API_KEY !== "string"
  ) {
    return;
  }
  try {
    const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_API_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_API_HOST,
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
