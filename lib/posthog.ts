import getConfig from "next/config";
import PostHog from "posthog-node";

const { serverRuntimeConfig } = getConfig();
const enabled =
  serverRuntimeConfig.posthogApiKey && serverRuntimeConfig.posthogApiHost;

export const caputurePosthogEvent = (userId, eventName, properties = {}) => {
  if (!enabled) {
    return;
  }
  const client = new PostHog(
    serverRuntimeConfig.posthogApiKey,
    { host: serverRuntimeConfig.posthogApiHost } // You can omit this line if using PostHog Cloud
  );

  console.log("send event!!!!!");

  client.capture({
    distinctId: userId,
    event: eventName,
    properties,
  });

  // On program exit, call shutdown to stop pending pollers and flush any remaining events
  client.shutdown();
};
