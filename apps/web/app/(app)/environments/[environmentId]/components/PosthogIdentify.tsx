"use client";

import type { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { env } from "@formbricks/lib/env";
import { TSubscriptionStatus } from "@formbricks/types/teams";

const posthogEnabled = env.NEXT_PUBLIC_POSTHOG_API_KEY && env.NEXT_PUBLIC_POSTHOG_API_HOST;

interface PosthogIdentifyProps {
  session: Session;
  environmentId?: string;
  teamId?: string;
  teamName?: string;
  inAppSurveyBillingStatus?: TSubscriptionStatus;
  linkSurveyBillingStatus?: TSubscriptionStatus;
  userTargetingBillingStatus?: TSubscriptionStatus;
}

export const PosthogIdentify = ({
  session,
  environmentId,
  teamId,
  teamName,
  inAppSurveyBillingStatus,
  linkSurveyBillingStatus,
  userTargetingBillingStatus,
}: PosthogIdentifyProps) => {
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
          inAppSurveyBillingStatus,
          linkSurveyBillingStatus,
          userTargetingBillingStatus,
        });
      }
    }
  }, [
    posthog,
    session.user,
    environmentId,
    teamId,
    teamName,
    inAppSurveyBillingStatus,
    linkSurveyBillingStatus,
    userTargetingBillingStatus,
  ]);

  return null;
};
