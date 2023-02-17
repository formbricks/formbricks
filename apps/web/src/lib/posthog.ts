import { useRouter } from "next/router";
import posthog from "posthog-js";
import { useEffect } from "react";

const enabled =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_POSTHOG_API_HOST &&
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY;

export const initPosthog = () => {
  if (typeof window !== "undefined" && enabled) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_API_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_API_HOST,
    });
  }
};

export const usePosthog = () => {
  const router = useRouter();
  useEffect(() => {
    let handleRouteChange = () => {};
    if (enabled) {
      // Track page views
      handleRouteChange = () => posthog.capture("$pageview");
      router.events.on("routeChangeComplete", handleRouteChange);
    }

    return () => {
      if (enabled) {
        router.events.off("routeChangeComplete", handleRouteChange);
      }
    };
  }, []);
};

export const identifyPosthogUser = (user) => {
  if (enabled) {
    posthog.identify(user.id, { email: user.email, name: user.name });
  }
};

export const capturePosthogEvent = async (userId, eventName, properties = {}) => {
  if (!enabled) {
    return;
  }
  try {
    await fetch(`${process.env.NEXT_PUBLIC_POSTHOG_API_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
        event: eventName,
        properties: {
          distinct_id: userId.toString(),
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("error sending posthog event:", error);
  }
};
