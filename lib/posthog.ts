import getConfig from "next/config";
import { hashString } from "./utils";

const { serverRuntimeConfig } = getConfig();
const enabled =
  process.env.NODE_ENV === "production" &&
  serverRuntimeConfig.posthogApiKey &&
  serverRuntimeConfig.posthogApiHost;

export const capturePosthogEvent = async (
  userId,
  eventName,
  properties = {}
) => {
  if (!enabled) {
    return;
  }
  try {
    await fetch(`${serverRuntimeConfig.posthogApiHost}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: serverRuntimeConfig.posthogApiKey,
        event: eventName,
        properties: {
          distinct_id: hashString(userId),
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("error sending posthog event:", error);
  }
};
