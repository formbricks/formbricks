"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export const ClientLogout = () => {
  useEffect(() => {
    signOut();
  });
  return null;
};
