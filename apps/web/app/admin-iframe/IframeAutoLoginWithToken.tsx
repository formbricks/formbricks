"use client";

import { Session } from "next-auth";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";

export const IframeAutoLoginWithToken: React.FC<React.PropsWithChildren<{ session: Session | null }>> = (
  props
) => {
  const { session, children } = props;

  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  React.useEffect(() => {
    if (!session && token) {
      signIn("iframe-token", { token })
        .then((res) => {
          console.log("iframe-token login res", res);
        })
        .catch((err) => {
          console.log("iframe-token login errr", err);
        });
    }

    if (session && token) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("token");
      router.replace(`?${newParams.toString()}`);
    }
  }, [router, searchParams, session, token]);

  if (session) {
    return (
      <>
        {/* <button style={{ border: "1px solid black" }} onClick={() => signOut()}>
          Sign out
        </button> */}
        {children}
      </>
    );
  }

  if (!token) {
    return <h1>Missing token</h1>;
  }

  return <h1> Not signed in</h1>;
};

export default IframeAutoLoginWithToken;
