"use client";

import type { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { env } from "@formbricks/lib/env.mjs";

const posthogEnabled = env.NEXT_PUBLIC_POSTHOG_API_KEY && env.NEXT_PUBLIC_POSTHOG_API_HOST;

export default function PosthogIdentify({
  session,
  environmentId,
}: {
  session: Session;
  environmentId: string;
}) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthogEnabled && session.user && posthog) {
      posthog.identify(session.user.id, { name: session.user.name, email: session.user.email });
      posthog.group("environment", environmentId, { name: environmentId });
    }
  }, [session, environmentId, posthog]);

  return null;
}
