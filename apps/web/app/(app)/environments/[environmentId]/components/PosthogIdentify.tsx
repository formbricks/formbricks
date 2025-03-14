"use client";

import type { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

interface PosthogIdentifyProps {
  session: Session;
  user: TUser;
  environmentId?: string;
  organizationId?: string;
  organizationName?: string;
  organizationBilling?: TOrganizationBilling;
  isPosthogEnabled: boolean;
}

export const PosthogIdentify = ({
  session,
  user,
  environmentId,
  organizationId,
  organizationName,
  organizationBilling,
  isPosthogEnabled,
}: PosthogIdentifyProps) => {
  const posthog = usePostHog();

  useEffect(() => {
    if (isPosthogEnabled && session.user && posthog) {
      posthog.identify(session.user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
        objective: user.objective,
      });
      if (environmentId) {
        posthog.group("environment", environmentId, { name: environmentId });
      }
      if (organizationId) {
        posthog.group("organization", organizationId, {
          name: organizationName,
          plan: organizationBilling?.plan,
          responseLimit: organizationBilling?.limits.monthly.responses,
          miuLimit: organizationBilling?.limits.monthly.miu,
        });
      }
    }
  }, [
    posthog,
    session.user,
    environmentId,
    organizationId,
    organizationName,
    organizationBilling,
    user.name,
    user.email,
    user.role,
    user.objective,
    isPosthogEnabled,
  ]);

  return null;
};
