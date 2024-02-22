"use client";

import type { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { env } from "@formbricks/lib/env.mjs";
import { TTeam } from "@formbricks/types/teams";

const posthogEnabled = env.NEXT_PUBLIC_POSTHOG_API_KEY && env.NEXT_PUBLIC_POSTHOG_API_HOST;

export default function PosthogIdentify({
  session,
  environmentId,
  team,
}: {
  session: Session;
  environmentId: string;
  team: TTeam;
}) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthogEnabled && session.user && posthog) {
      posthog.identify(session.user.id, { name: session.user.name, email: session.user.email });
      posthog.group("environment", environmentId, { name: environmentId });
      posthog.group("team", team.id, { name: team.name, billing: team.billing });
    }
  }, [session, environmentId, team.id, posthog, team.name, team.billing]);

  return null;
}
