"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export const SignIn = ({ token, webAppUrl }: { token: string; webAppUrl: string }) => {
  useEffect(() => {
    if (token) {
      signIn("token", {
        token: token,
        callbackUrl: webAppUrl,
      });
    }
  }, [token, webAppUrl]);

  return <></>;
};
