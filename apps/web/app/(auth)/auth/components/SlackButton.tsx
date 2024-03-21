"use client";

import { signIn } from "next-auth/react";
import { FaSlack } from "react-icons/fa";

import { Button } from "@formbricks/ui/Button";

interface SlackButtonProps {
  environmentId: string;
  text?: string;
  inviteUrl?: string | null;
}

export const SlackButton = ({ environmentId, text = "Continue with Slack" }: SlackButtonProps) => {
  const handleLogin = async () => {
    await signIn("slack", {
      redirect: true,
      callbackUrl: `/api/slack/callback?environment=${environmentId}`, // redirect after login to /
    });
  };

  return (
    <Button
      type="button"
      EndIcon={FaSlack}
      startIconClassName="ml-3"
      onClick={handleLogin}
      variant="secondary"
      className="w-full justify-center">
      {text}
    </Button>
  );
};
