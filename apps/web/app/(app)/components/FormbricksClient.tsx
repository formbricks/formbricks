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
      formbricks.init({
        environmentId: env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
        apiHost: env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
        userId,
      });

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
