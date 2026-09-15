"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { IS_DEVELOPMENT_BUILD } from "@/lib/env-client";

interface PostHogIdentifyProps {
  posthogKey: string;
  userId: string;
  email: string;
  name: string | null;
  // Most recent survey creation timestamp (ISO 8601) across every organization this person belongs
  // to, not just the org/workspace open right now — see lib/posthog/last-survey-created.ts. Recomputed
  // server-side on every app page load, so a teammate creating a survey in a shared organization
  // still moves this forward for this person the next time they load a page, without this person
  // having created anything themselves.
  lastSurveyCreatedAt: string | null;
}

export const PostHogIdentify = ({
  posthogKey,
  userId,
  email,
  name,
  lastSurveyCreatedAt,
}: Readonly<PostHogIdentifyProps>) => {
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

    posthog.identify(userId, { email, name, last_survey_created_at: lastSurveyCreatedAt });
    lastIdentifiedUserId.current = userId;
  }, [posthogKey, userId, email, name, lastSurveyCreatedAt]);

  return null;
};
