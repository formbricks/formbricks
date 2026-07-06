"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import formbricks from "@formbricks/js";

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
}: FormbricksProviderProps) => {
  const pathname = usePathname();

  // Set up the SDK and identify the user.
  useEffect(() => {
    if (!workspaceId) return;

    void (async () => {
      await formbricks.setup({ workspaceId, appUrl });

      if (userId) {
        await formbricks.setUserId(userId);
        const attributes: Record<string, string> = {};
        if (userEmail) attributes.email = userEmail;
        if (userName) attributes.name = userName;
        if (Object.keys(attributes).length > 0) {
          await formbricks.setAttributes(attributes);
        }
      }
    })();
  }, [workspaceId, appUrl, userId, userEmail, userName]);

  // Track client-side navigations for page-triggered surveys.
  useEffect(() => {
    if (!workspaceId) return;
    void formbricks.registerRouteChange();
  }, [workspaceId, pathname]);

  return null;
};
