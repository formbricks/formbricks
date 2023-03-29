import { PostHog } from "posthog-node";

const enabled =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_POSTHOG_API_HOST &&
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY;

export const capturePosthogEvent = async (
  userId: string,
  eventName: string,
  teamId?: string,
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
      event: eventName,
      distinctId: userId,
      groups: teamId ? { company: teamId } : {},
      properties,
    });

    await client.shutdownAsync();
  } catch (error) {
    console.error("error sending posthog event:", error);
  }
};
