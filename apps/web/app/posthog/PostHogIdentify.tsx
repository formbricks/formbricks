"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { IS_DEVELOPMENT_BUILD } from "@/lib/env-client";

interface PostHogIdentifyProps {
  posthogKey: string;
  userId: string;
  email: string;
  name: string | null;
}

export const PostHogIdentify = ({ posthogKey, userId, email, name }: PostHogIdentifyProps) => {
  const lastIdentifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog.__loaded) {
      posthog.init(posthogKey, {
        api_host: "/ingest",
        ui_host: "https://eu.i.posthog.com",
        defaults: "2026-01-30",
        capture_exceptions: true,
        debug: IS_DEVELOPMENT_BUILD,
        session_recording: {
          blockSelector: "iframe[src*='cdn-plain']",
        },
      });
    }

    if (lastIdentifiedUserId.current && lastIdentifiedUserId.current !== userId) {
      posthog.reset();
    }

    posthog.identify(userId, { email, name });
    lastIdentifiedUserId.current = userId;
  }, [posthogKey, userId, email, name]);

  return null;
};
