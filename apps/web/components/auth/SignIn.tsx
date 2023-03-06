"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export const SignIn = ({ token }) => {
  useEffect(() => {
    if (token) {
      signIn("token", {
        token: token,
        callbackUrl: `/`,
      });
    }
  }, [token]);

  return <></>;
};
