"use client";

import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { useEffect } from "react";

export const ClientLogout = () => {
  const { signOut: signOutWithAudit } = useSignOut();

  useEffect(() => {
    signOutWithAudit({
      reason: "forced_logout",
      redirectUrl: "/auth/login",
      redirect: false,
      callbackUrl: "/auth/login",
      clearEnvironmentId: true,
    });
  });
  return null;
};
