"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import formbricks from "@formbricks/js";

interface FormbricksClientProps {
  userId: string;
  email: string;
  formbricksEnvironmentId?: string;
  formbricksApiHost?: string;
  formbricksEnabled?: boolean;
}

export const FormbricksClient = ({
  userId,
  email,
  formbricksEnvironmentId,
  formbricksApiHost,
  formbricksEnabled,
}: FormbricksClientProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (formbricksEnabled && userId) {
      formbricks.init({
        environmentId: formbricksEnvironmentId ?? "",
        apiHost: formbricksApiHost ?? "",
        userId,
      });

      formbricks.setEmail(email);
    }
  }, [userId, email, formbricksEnvironmentId, formbricksApiHost, formbricksEnabled]);

  useEffect(() => {
    if (formbricksEnabled) {
      formbricks.registerRouteChange();
    }
  }, [pathname, searchParams, formbricksEnabled]);

  return null;
};
