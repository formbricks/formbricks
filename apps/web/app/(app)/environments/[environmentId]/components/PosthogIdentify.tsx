"use client";

import type { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { env } from "@formbricks/lib/env";
import { TTeamBilling } from "@formbricks/types/teams";

const posthogEnabled = env.NEXT_PUBLIC_POSTHOG_API_KEY && env.NEXT_PUBLIC_POSTHOG_API_HOST;

export default function PosthogIdentify({
  session,
  environmentId,
  teamId,
  teamName,
  billing,
}: {
  session: Session;
  environmentId?: string;
  teamId?: string;
  teamName?: string;
  billing: TTeamBilling;
}) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthogEnabled && session.user && posthog) {
      posthog.identify(session.user.id, {
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        objective: session.user.objective,
      });
      if (environmentId) {
        posthog.group("environment", environmentId, { name: environmentId });
      }
      if (teamId) {
        posthog.group("team", teamId, {
          name: teamName,
          plan: billing.plan,
          responseLimit: billing.limits.monthly.responses,
          miuLimit: billing.limits.monthly.miu,
        });
      }
    }
  }, [posthog, session.user, environmentId, teamId, teamName, billing]);

  return null;
}
