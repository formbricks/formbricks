"use client";

import { formbricksEnabled } from "@/app/lib/formbricks";
import type { Session } from "next-auth";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import formbricks from "@formbricks/js/app";
import { env } from "@formbricks/lib/env";

type UsageAttributesUpdaterProps = {
  numSurveys: number;
};

export const FormbricksClient = ({ session, userEmail }: { session: Session; userEmail: string }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initializeFormbricksAndSetupRouteChanges = useCallback(async () => {
    formbricks.init({
      environmentId: env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
      apiHost: env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
      userId: session.user.id,
    });
    formbricks.setEmail(userEmail);

    formbricks.registerRouteChange();
  }, [session.user.id, userEmail]);

  useEffect(() => {
    if (formbricksEnabled && session?.user?.id && formbricks) {
      initializeFormbricksAndSetupRouteChanges();
    }
  }, [session, pathname, searchParams, initializeFormbricksAndSetupRouteChanges]);

  return null;
};

const updateUsageAttributes = (numSurveys) => {
  if (!formbricksEnabled) return;

  if (numSurveys >= 3) {
    formbricks.setAttribute("HasThreeSurveys", "true");
  }
};

export const UsageAttributesUpdater = ({ numSurveys }: UsageAttributesUpdaterProps) => {
  useEffect(() => {
    updateUsageAttributes(numSurveys);
  }, [numSurveys]);

  return null;
};
