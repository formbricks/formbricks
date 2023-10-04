"use client";

import { env } from "@/env.mjs";
import { formbricksEnabled } from "@/lib/formbricks";
import formbricks from "@formbricks/js";
import { useEffect } from "react";

type UsageAttributesUpdaterProps = {
  numSurveys: number;
};

export default function FormbricksClient({ session }) {
  useEffect(() => {
    if (formbricksEnabled && session?.user && formbricks) {
      formbricks.init({
        environmentId: env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
        apiHost: env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
      });
      formbricks.setUserId(session.user.id);
      formbricks.setEmail(session.user.email);
    }
  }, [session]);
  return null;
}

const updateUsageAttributes = (numSurveys) => {
  if (!formbricksEnabled) return;

  if (numSurveys >= 3) {
    formbricks.setAttribute("HasThreeSurveys", "true");
  }
};

export function UsageAttributesUpdater({ numSurveys }: UsageAttributesUpdaterProps) {
  useEffect(() => {
    updateUsageAttributes(numSurveys);
  }, [numSurveys]);

  return null;
}
