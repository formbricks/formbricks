"use client";

import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { signOut } from "next-auth/react";
import { useEffect } from "react";

export const ClientLogout = () => {
  useEffect(() => {
    localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
    signOut();
  });
  return null;
};
