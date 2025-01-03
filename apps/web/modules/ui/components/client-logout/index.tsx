"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { signOut } from "next-auth/react";
import { useEffect } from "react";

export const ClientLogout = () => {
  useEffect(() => {
    formbricksLogout();
    signOut();
  });
  return null;
};
