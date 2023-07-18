"use client";

import { env } from "@/env.mjs";
import { formbricksEnabled } from "@/lib/formbricks";
import formbricks from "@formbricks/js";
import { useEffect } from "react";

export default function FormbricksClient({ session }) {
  useEffect(() => {
    if (formbricksEnabled && session.user && formbricks) {
      formbricks.init({
        environmentId: env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID || "",
        apiHost: env.NEXT_PUBLIC_FORMBRICKS_API_HOST || "",
      });
      formbricks.setUserId(session.user.id);
      formbricks.setEmail(session.user.email);
      if (session.user.teams?.length > 0) {
        formbricks.setAttribute("Plan", session.user.teams[0].plan);
      }
    }
  }, [session]);
  return null;
}
