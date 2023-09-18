"use client";

import { env } from "@/env.mjs";
import { formbricksEnabled } from "@/lib/formbricks";
import formbricks from "@formbricks/js";
import { useEffect } from "react";

type UsageAttributesUpdaterProps = {
  numSurveys: number;
  totalSubmissions: number;
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
      if (session.user.teams?.length > 0) {
        formbricks.setAttribute("Plan", session.user.teams[0].plan);
        formbricks.setAttribute("Name", session?.user?.name);
      }
    }
  }, [session]);
  return null;
}

const updateUsageAttributes = (numSurveys, totalSubmissions) => {
  if (!formbricksEnabled) return;

  if (numSurveys >= 3) {
    formbricks.setAttribute("HasThreeSurveys", "true");
  }

  if (totalSubmissions >= 20) {
    formbricks.setAttribute("HasTwentySubmissions", "true");
  }
};

export function UsageAttributesUpdater({ numSurveys, totalSubmissions }: UsageAttributesUpdaterProps) {
  useEffect(() => {
    updateUsageAttributes(numSurveys, totalSubmissions);
  }, [numSurveys, totalSubmissions]);

  return null;
}
