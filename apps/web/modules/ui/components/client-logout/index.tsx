"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { useLogout } from "@account-kit/react";
import { signOut } from "next-auth/react";
import { useEffect } from "react";

export const ClientLogout = () => {
  const { logout } = useLogout({});

  useEffect(() => {
    logout();
    formbricksLogout();
    signOut();
  }, [logout]);
  return null;
};
