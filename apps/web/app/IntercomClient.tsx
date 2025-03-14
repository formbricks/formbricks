"use client";

import Intercom from "@intercom/messenger-js-sdk";
import { createHmac } from "crypto";
import { useCallback, useEffect } from "react";
import { TUser } from "@formbricks/types/user";

interface IntercomClientProps {
  isIntercomConfigured: boolean;
  intercomSecretKey?: string;
  user?: TUser | null;
  intercomAppId: string;
}

export const IntercomClient = ({
  user,
  intercomSecretKey,
  isIntercomConfigured,
  intercomAppId,
}: IntercomClientProps) => {
  const initializeIntercom = useCallback(() => {
    let initParams = {};

    if (user) {
      const { id, name, email, createdAt } = user;
      const hash = createHmac("sha256", intercomSecretKey!).update(user?.id).digest("hex");

      initParams = {
        user_id: id,
        user_hash: hash,
        name,
        email,
        created_at: createdAt ? Math.floor(createdAt.getTime() / 1000) : undefined,
      };
    }

    Intercom({
      app_id: intercomAppId,
      ...initParams,
    });
  }, [user, intercomSecretKey, intercomAppId]);

  useEffect(() => {
    try {
      if (isIntercomConfigured) initializeIntercom();

      return () => {
        // Shutdown Intercom when component unmounts
        if (typeof window !== "undefined" && window.Intercom) {
          window.Intercom("shutdown");
        }
      };
    } catch (error) {
      console.error("Failed to initialize Intercom:", error);
    }
  }, [isIntercomConfigured, initializeIntercom]);

  return null;
};
