"use client";

import { formbricksEnabled } from "@/app/lib/formbricks";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import formbricks from "@formbricks/js";
import { env } from "@formbricks/lib/env";

export const FormbricksClient = ({ userId, email }: { userId: string; email: string }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (formbricksEnabled && userId) {
      formbricks.setup({
        environmentId: env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
        appUrl: env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
      });

      formbricks.setUserId(userId);
      formbricks.setEmail(email);
    }
  }, [userId, email]);

  useEffect(() => {
    if (formbricksEnabled) {
      formbricks.registerRouteChange();
    }
  }, [pathname, searchParams]);

  return null;
};
