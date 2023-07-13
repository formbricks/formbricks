"use client";
import { env } from "@/env.mjs";
import type { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

const posthogEnabled = env.NEXT_PUBLIC_POSTHOG_API_KEY && env.NEXT_PUBLIC_POSTHOG_API_HOST;

export default function PosthogIdentify({ session }: { session: Session }) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthogEnabled && session.user && posthog) {
      posthog.identify(session.user.id);
      if (session.user.teams?.length > 0) {
        posthog?.group("team", session.user.teams[0].id);
      }
    }
  }, [session, posthog]);

  return null;
}
