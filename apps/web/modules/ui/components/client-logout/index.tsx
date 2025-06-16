"use client";

import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { useEffect } from "react";

interface ClientLogoutProps {
  userId?: string;
  userEmail?: string;
}

export const ClientLogout = ({ userId, userEmail }: ClientLogoutProps) => {
  const { signOut: signOutWithAudit } = useSignOut({ id: userId ?? "", email: userEmail ?? "" });

  useEffect(() => {
    localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
    signOutWithAudit({
      reason: "forced_logout",
      redirectUrl: "/auth/login",
      redirect: false,
      callbackUrl: "/auth/login",
    });
  });
  return null;
};
