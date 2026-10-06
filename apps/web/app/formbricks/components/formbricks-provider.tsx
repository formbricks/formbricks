"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import formbricks from "@formbricks/js";
import { consumeChurnSurveyMarker } from "@/lib/churn-survey";

interface FormbricksProviderProps {
  workspaceId: string;
  appUrl: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
}

/**
 * Initializes the Formbricks SDK on the client, identifies the logged-in user, and
 * tracks client-side route changes so page-triggered surveys fire on navigation.
 */
export const FormbricksProvider = ({
  workspaceId,
  appUrl,
  userId,
  userEmail,
  userName,
}: Readonly<FormbricksProviderProps>) => {
  const pathname = usePathname();
  // Guards against a second effect run (deps changing mid-flight) reading and tracking the same
  // marker again before the first run has cleared it.
  const churnTrackInFlightRef = useRef(false);

  // Set up the SDK and identify the user.
  useEffect(() => {
    if (!workspaceId) return;

    const setupFormbricks = async () => {
      await formbricks.setup({ workspaceId, appUrl });

      if (userId) {
        await formbricks.setUserId(userId);
        const attributes: Record<string, string> = {};
        if (userEmail) attributes.email = userEmail;
        const [firstName = "", ...rest] = (userName ?? "").trim().split(/\s+/);
        attributes.firstName = firstName;
        attributes.lastName = rest.join(" ");
        await formbricks.setAttributes(attributes);

        await consumeChurnSurveyMarker({
          storage: globalThis.window?.sessionStorage,
          userId,
          track: (event) => formbricks.track(event),
          inFlight: churnTrackInFlightRef,
        });
      }
    };

    // Handle rejections so failed SDK calls don't become unhandled promise rejections.
    setupFormbricks().catch((error) => {
      console.error("Formbricks setup failed:", error);
    });
  }, [workspaceId, appUrl, userId, userEmail, userName]);

  // Track client-side navigations for page-triggered surveys.
  useEffect(() => {
    if (!workspaceId) return;
    formbricks.registerRouteChange().catch((error) => {
      console.error("Formbricks route change failed:", error);
    });
  }, [workspaceId, pathname]);

  return null;
};
