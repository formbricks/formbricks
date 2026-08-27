"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

interface PostHogGroupIdentifyProps {
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  workspaceName: string;
  // Role of the current user within the organization and (optionally) the
  // active workspace. Set as person-level properties so PostHog analytics
  // can segment people by role, not just by the org/workspace group they
  // belong to.
  organizationRole: TOrganizationRole;
  workspacePermission: TTeamPermission | null;
}

export const PostHogGroupIdentify = ({
  organizationId,
  organizationName,
  workspaceId,
  workspaceName,
  organizationRole,
  workspacePermission,
}: PostHogGroupIdentifyProps) => {
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const applyGroups = () => {
      posthog.group("organization", organizationId, { name: organizationName });
      posthog.group("workspace", workspaceId, { name: workspaceName });

      // Person-level role properties. These live on the person profile (not
      // the group), so a person's role shows up in cohorts, funnels, and
      // person filters without joining through group analytics.
      posthog.setPersonProperties({
        organization_role: organizationRole,
        workspace_permission: workspacePermission,
      });
    };

    if (posthog.__loaded) {
      applyGroups();
      return;
    }

    // PostHogIdentify (in app layout) initialises posthog from a sibling
    // useEffect; effect order isn't guaranteed, so poll briefly until loaded.
    const intervalId = setInterval(() => {
      if (cancelledRef.current) return;
      if (posthog.__loaded) {
        applyGroups();
        clearInterval(intervalId);
      }
    }, 50);

    const timeoutId = setTimeout(() => {
      cancelledRef.current = true;
      clearInterval(intervalId);
    }, 5000);

    return () => {
      cancelledRef.current = true;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [organizationId, organizationName, workspaceId, workspaceName, organizationRole, workspacePermission]);

  return null;
};
