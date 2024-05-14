"use client";

import { formbricksEnabled } from "@/app/lib/formbricks";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import formbricks from "@formbricks/js/app";
import { env } from "@formbricks/lib/env";

type UsageAttributesUpdaterProps = {
  numSurveys: number;
};

export const FormbricksClient = ({ session }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (formbricksEnabled && session?.user && formbricks) {
      formbricks.init({
        environmentId: env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
        apiHost: env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
        userId: session.user.id,
      });
      formbricks.setEmail(session.user.email);
    }
  }, [session]);

  useEffect(() => {
    if (formbricksEnabled && formbricks) {
      formbricks?.registerRouteChange();
    }
  }, [pathname, searchParams]);
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
