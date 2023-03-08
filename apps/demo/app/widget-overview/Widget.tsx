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
    formbricks.setUserId("12345");
    setTimeout(() => {
      console.log("trackingEvent");
      //formbricks.track("View Homepage");
    }, 1000);
  }, []);
  return null;
}
