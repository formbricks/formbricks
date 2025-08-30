"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export const SignIn = ({ jwt, callbackUrl = "/" }: { jwt: string; callbackUrl?: string }) => {
  useEffect(() => {
    if (jwt) {
      signIn("external-jwt", {
        jwt,
        callbackUrl,
      });
    }
  }, [jwt, callbackUrl]);

  return <></>;
};
