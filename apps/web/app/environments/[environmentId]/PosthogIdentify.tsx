"use client";
import type { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

const posthogEnabled = process.env.NEXT_PUBLIC_POSTHOG_API_KEY && process.env.NEXT_PUBLIC_POSTHOG_API_HOST;

export default function PosthogIdentify({ session }: { session: Session }) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthogEnabled && session.user && posthog) {
      posthog.identify(session.user.id);
      if (session.user.teamId) {
        posthog?.group("team", session.user.teamId);
      }
    }
  }, [session, posthog]);

  return null;
}
