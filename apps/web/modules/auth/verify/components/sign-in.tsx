"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export const SignIn = ({ token, callbackUrl }: { token: string; callbackUrl: string }) => {
  useEffect(() => {
    if (token) {
      signIn("token", {
        token: token,
        callbackUrl,
      });
    }
  }, [callbackUrl, token]);

  return <></>;
};
