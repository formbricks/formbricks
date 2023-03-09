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
    formbricks.setUserId("123456");
    formbricks.setEmail("user@example.com");
    formbricks.setAttribute("name", "Jane Doe");
    formbricks.setAttribute("plan", "free");
    formbricks.track("View Home Page");
    setTimeout(() => {
      console.log("trackingEvent");
      //formbricks.track("View Homepage");
    }, 1000);
  }, []);
  return null;
}
