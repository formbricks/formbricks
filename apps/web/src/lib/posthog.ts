import { hashString } from "./utils";

const enabled =
  process.env.NODE_ENV === "production" && process.env.POSTHOG_API_HOST && process.env.POSTHOG_API_KEY;

export const capturePosthogEvent = async (userId, eventName, properties = {}) => {
  if (!enabled) {
    return;
  }
  try {
    await fetch(`${process.env.POSTHOG_API_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_API_KEY,
        event: eventName,
        properties: {
          distinct_id: hashString(userId.toString()),
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("error sending posthog event:", error);
  }
};
