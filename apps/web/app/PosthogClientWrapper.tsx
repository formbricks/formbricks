"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

const posthogEnabled = process.env.NEXT_PUBLIC_POSTHOG_API_KEY && process.env.NEXT_PUBLIC_POSTHOG_API_HOST;

// Check that PostHog is client-side (used to handle Next.js SSR)
if (
  typeof window !== "undefined" &&
  posthogEnabled &&
  typeof process.env.NEXT_PUBLIC_POSTHOG_API_KEY === "string" &&
  typeof process.env.NEXT_PUBLIC_POSTHOG_API_HOST === "string"
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_API_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_API_HOST,
    // Disable in development
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") posthog.opt_out_capturing();
    },
  });
}

export function PosthogClientWrapper({ children }: { children: React.ReactNode }) {
  if (posthogEnabled) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
  } else {
    return <>{children}</>;
  }
}
