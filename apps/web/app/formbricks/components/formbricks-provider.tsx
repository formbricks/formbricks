"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import formbricks from "@formbricks/js";

export const CHURN_SURVEY_PENDING_KEY = "churnSurveyPending";

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
      }

      const churnSurveyPending =
        globalThis.window !== undefined && globalThis.window.sessionStorage.getItem(CHURN_SURVEY_PENDING_KEY);
      if (churnSurveyPending) {
        globalThis.window.sessionStorage.removeItem(CHURN_SURVEY_PENDING_KEY);
        await formbricks.track("subscription_cancelled").catch(() => undefined);
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
