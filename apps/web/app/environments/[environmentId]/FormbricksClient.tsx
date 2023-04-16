"use client";

import formbricks from "@formbricks/js";
import { useEffect } from "react";

const formbricksEnabled =
  typeof process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST && process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

if (typeof window !== "undefined" && formbricksEnabled) {
  formbricks.init({
    environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
    apiHost: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
  });
}

export default function FormbricksClient({ session }) {
  useEffect(() => {
    if (formbricksEnabled && session.user && formbricks) {
      formbricks.setUserId(session.user.id);
      formbricks.setEmail(session.user.email);
      if (session.user.plan) {
        formbricks.setAttribute("Plan", session.user.plan);
      }
    }
  }, [session]);
  return null;
}
