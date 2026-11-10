"use client";

import { useEffect } from "react";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";

export const ClientLogout = () => {
  const { signOut } = useSignOut();

  useEffect(() => {
    signOut({
      redirect: false,
      callbackUrl: "/auth/login",
      clearWorkspaceId: true,
    });
  });
  return null;
};
