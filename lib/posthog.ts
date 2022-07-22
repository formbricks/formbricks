import { useRouter } from "next/router";
import getConfig from "next/config";
import posthog from "posthog-js";
import { useEffect } from "react";

const { publicRuntimeConfig } = getConfig();
const enabled =
  publicRuntimeConfig.posthogApiKey && publicRuntimeConfig.posthogApiHost;

export const usePosthog = (userId?: string, anonymous = false) => {
  const router = useRouter();

  useEffect(() => {
    if (enabled && (userId || anonymous)) {
      // Init PostHog
      posthog.init(publicRuntimeConfig.posthogApiKey, {
        api_host: publicRuntimeConfig.posthogApiHost,
        loaded: function (posthog) {
          if (process.env.NODE_ENV === "development")
            posthog.opt_out_capturing();
          if (userId && !anonymous) {
            posthog.identify(userId);
          }
        },
      });
    }
    // Track page views
    const handleRouteChange = () => {
      if (enabled && (userId || anonymous)) {
        posthog.capture("$pageview");
      }
    };
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events, userId, anonymous]);
};

export const trackPosthogEvent = (eventName: string, attributes: object) => {
  if (enabled) {
    posthog.capture(eventName, attributes);
  }
};

export const identifyPoshogUser = (userId: string) => {
  if (enabled) {
    posthog.identify(userId);
  }
};
