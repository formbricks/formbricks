import getConfig from "next/config";
import { hashString } from "./utils";

const { serverRuntimeConfig } = getConfig();
const enabled =
  process.env.NODE_ENV === "production" &&
  serverRuntimeConfig.posthogApiKey &&
  serverRuntimeConfig.posthogApiHost;

export const caputurePosthogEvent = async (
  userId,
  eventName,
  properties = {}
) => {
  if (!enabled) {
    console.log("posthog not enabled");
    console.log(process.env.NODE_ENV === "production");
    console.log(
      serverRuntimeConfig.posthogApiKey && serverRuntimeConfig.posthogApiHost
    );
    return;
  }
  try {
    const res = await fetch(`${serverRuntimeConfig.posthogApiHost}/capture/`, {
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
    const text = await res.text();
    console.log(text);
  } catch (error) {
    console.error(error);
  }
};
