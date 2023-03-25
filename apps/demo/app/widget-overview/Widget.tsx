"use client";

import formbricks from "@formbricks/js";
import { useEffect } from "react";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
    apiHost: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
    logLevel: "debug",
  });
}

export default function Widget() {
  useEffect(() => {
    setTimeout(() => {
      formbricks.track("View Home Page");
      formbricks.setUserId("123456");
      formbricks.setEmail("user@example.com");
    }, 2000);
    /* formbricks.track("View Home Page");
    formbricks.setAttribute("name", "Jane Doe");
    formbricks.setEmail("user@example.com");
    formbricks.setUserId("123456"); */
  }, []);
  return null;
}
