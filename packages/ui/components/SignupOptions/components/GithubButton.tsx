"use client";

import { signIn } from "next-auth/react";
import { Button } from "../../Button";
import { GithubIcon } from "../../icons";

export const GithubButton = ({
  text = "Continue with Github",
  inviteUrl,
  lastUsed,
}: {
  text?: string;
  inviteUrl?: string | null;
  lastUsed?: boolean;
}) => {
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("loggedInWith", "Github");
    }
    await signIn("github", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
    });
  };

  return (
    <Button
      type="button"
      EndIcon={GithubIcon}
      startIconClassName="ml-2"
      onClick={handleLogin}
      variant="secondary"
      className={`relative w-full ${!lastUsed ? "justify-center" : "justify-start"}`}>
      {text}
      {lastUsed && <i className="absolute right-5">Last Used</i>}
    </Button>
  );
};
