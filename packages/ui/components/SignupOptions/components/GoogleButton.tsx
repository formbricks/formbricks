"use client";

import { signIn } from "next-auth/react";
import { Button } from "../../Button";
import { GoogleIcon } from "../../icons";

export const GoogleButton = ({
  text = "Continue with Google",
  inviteUrl,
  lastUsed,
}: {
  text?: string;
  inviteUrl?: string | null;
  lastUsed?: boolean;
}) => {
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("loggedInWith", "Google");
    }
    await signIn("google", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
    });
  };

  return (
    <Button
      type="button"
      EndIcon={GoogleIcon}
      startIconClassName="ml-3"
      onClick={handleLogin}
      variant="secondary"
      className={`relative w-full ${!lastUsed ? "justify-center" : "justify-start"}`}>
      {text}
      {lastUsed && <i className="absolute right-5">Last Used</i>}
    </Button>
  );
};
