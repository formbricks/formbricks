"use client";

import formbricks from "@formbricks/js";
import { useEffect } from "react";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
    apiHost: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
  });
}

export default function Widget() {
  useEffect(() => {
    formbricks.track("View Home Page");
    formbricks.setAttribute("name", "Jane Doe");
    /* formbricks.setEmail("user@example.com");
    formbricks.setUserId("123456"); */
    /* formbricks.setEmail("user@example.com");
    formbricks.setAttribute("name", "Jane Doe");
    formbricks.setAttribute("plan", "free");
    formbricks.setAttribute("name", "Pete Doe");
    formbricks.track("View Home Page"); */
  }, []);
  return null;
}
