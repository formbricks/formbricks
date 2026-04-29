"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

interface PostHogGroupIdentifyProps {
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  workspaceName: string;
}

export const PostHogGroupIdentify = ({
  organizationId,
  organizationName,
  workspaceId,
  workspaceName,
}: PostHogGroupIdentifyProps) => {
  useEffect(() => {
    let cancelled = false;

    const applyGroups = () => {
      posthog.group("organization", organizationId, { name: organizationName });
      posthog.group("workspace", workspaceId, { name: workspaceName });
    };

    if (posthog.__loaded) {
      applyGroups();
      return;
    }

    // PostHogIdentify (in app layout) initialises posthog from a sibling
    // useEffect; effect order isn't guaranteed, so poll briefly until loaded.
    const intervalId = setInterval(() => {
      if (cancelled) return;
      if (posthog.__loaded) {
        applyGroups();
        clearInterval(intervalId);
      }
    }, 50);

    const timeoutId = setTimeout(() => {
      cancelled = true;
      clearInterval(intervalId);
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [organizationId, organizationName, workspaceId, workspaceName]);

  return null;
};
