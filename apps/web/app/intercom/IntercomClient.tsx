"use client";

import Intercom from "@intercom/messenger-js-sdk";
import { useCallback, useEffect } from "react";
import { TUser } from "@formbricks/types/user";

interface IntercomClientProps {
  isIntercomConfigured: boolean;
  intercomUserHash?: string;
  user?: TUser | null;
  intercomAppId?: string;
}

export const IntercomClient = ({
  user,
  intercomUserHash,
  isIntercomConfigured,
  intercomAppId,
}: IntercomClientProps) => {
  const initializeIntercom = useCallback(() => {
    let initParams = {};

    if (user) {
      const { id, name, email, createdAt } = user;

      initParams = {
        user_id: id,
        user_hash: intercomUserHash,
        name,
        email,
        created_at: createdAt ? Math.floor(createdAt.getTime() / 1000) : undefined,
      };
    }

    Intercom({
      app_id: intercomAppId!,
      ...initParams,
    });
  }, [user, intercomUserHash, intercomAppId]);

  useEffect(() => {
    try {
      if (isIntercomConfigured) {
        if (!intercomAppId) {
          throw new Error("Intercom app ID is required");
        }

        if (!intercomUserHash) {
          throw new Error("Intercom user hash is required");
        }

        initializeIntercom();
      }

      return () => {
        // Shutdown Intercom when component unmounts
        if (typeof window !== "undefined" && window.Intercom) {
          window.Intercom("shutdown");
        }
      };
    } catch (error) {
      console.error("Failed to initialize Intercom:", error);
    }
  }, [isIntercomConfigured, initializeIntercom, intercomAppId, intercomUserHash]);

  return null;
};
