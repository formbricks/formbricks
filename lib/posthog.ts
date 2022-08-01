import { useRouter } from "next/router";
import getConfig from "next/config";
import posthog from "posthog-js";
import { useEffect } from "react";

const { publicRuntimeConfig } = getConfig();
const enabled =
  publicRuntimeConfig.posthogApiKey && publicRuntimeConfig.posthogApiHost;

export const usePosthog = () => {
  const router = useRouter();

  useEffect(() => {
    if (enabled) {
      // Init PostHog
      posthog.init(publicRuntimeConfig.posthogApiKey, {
        api_host: publicRuntimeConfig.posthogApiHost,
        loaded: function (posthog) {
          if (process.env.NODE_ENV === "development")
            posthog.opt_out_capturing();
        },
      });
    }
    // Track page views
    const handleRouteChange = () => {
      if (enabled) {
        posthog.capture("$pageview");
      }
    };
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);
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
