import "server-only";
import { PostHog } from "posthog-node";
import { logger } from "@formbricks/logger";
import { POSTHOG_KEY } from "@/lib/constants";

const POSTHOG_HOST = "https://eu.i.posthog.com";

const globalForPostHog = globalThis as unknown as {
  posthogServerClient: PostHog | undefined;
  posthogHandlersRegistered: boolean | undefined;
};

function createPostHogClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;

  return new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

export const posthogServerClient: PostHog | null =
  globalForPostHog.posthogServerClient ?? createPostHogClient();

if (process.env.NODE_ENV !== "production" && posthogServerClient) {
  globalForPostHog.posthogServerClient = posthogServerClient;
}

if (
  process.env.NEXT_RUNTIME === "nodejs" &&
  posthogServerClient &&
  !globalForPostHog.posthogHandlersRegistered
) {
  const shutdownPostHog = () => {
    posthogServerClient?.shutdown().catch((err) => {
      logger.error(err, "Error shutting down PostHog server client");
    });
  };
  process.on("SIGTERM", shutdownPostHog);
  process.on("SIGINT", shutdownPostHog);
  globalForPostHog.posthogHandlersRegistered = true;
}
