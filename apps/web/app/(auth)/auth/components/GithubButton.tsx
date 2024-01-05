"use client";

import { signIn } from "next-auth/react";
import { FaGithub } from "react-icons/fa";

import { Button } from "@formbricks/ui/Button";

export const GithubButton = ({
  text = "Continue with Github",
  inviteUrl,
}: {
  text?: string;
  inviteUrl?: string | null;
}) => {
  const handleLogin = async () => {
    await signIn("github", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
    });
  };

  return (
    <Button
      type="button"
      EndIcon={FaGithub}
      startIconClassName="ml-2"
      onClick={handleLogin}
      variant="secondary"
      className="w-full justify-center">
      {text}
    </Button>
  );
};
