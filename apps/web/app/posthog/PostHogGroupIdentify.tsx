"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";

interface PostHogGroupIdentifyProps {
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  workspaceName: string;
  // Full role snapshot across every organization the person belongs to (not just this one) — see
  // lib/posthog/organization-roles.ts for why a single "current org" role isn't enough. Recomputed
  // server-side on every workspace load, so this call is idempotent and self-healing regardless of
  // which org/workspace the person is currently viewing.
  organizationRoles: { organization_id: string; role: string }[];
  organizationCount: number;
}

export const PostHogGroupIdentify = ({
  organizationId,
  organizationName,
  workspaceId,
  workspaceName,
  organizationRoles,
  organizationCount,
}: PostHogGroupIdentifyProps) => {
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const applyGroups = () => {
      posthog.group("organization", organizationId, { name: organizationName });
      posthog.group("workspace", workspaceId, { name: workspaceName });

      // Person-level role properties. These live on the person profile (not the group), so a
      // person's role shows up in cohorts, funnels, and person filters without joining through
      // group analytics. Filter on organization_roles via HogQL for per-org queries (e.g. owners).
      posthog.setPersonProperties({
        organization_roles: organizationRoles,
        organization_count: organizationCount,
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
  }, [organizationId, organizationName, workspaceId, workspaceName, organizationRoles, organizationCount]);

  return null;
};
