"use client";

import { signIn } from "next-auth/react";

import { Button } from "@formbricks/ui/Button";

interface SlackButtonProps {
  environmentId: string;
  text?: string;
  inviteUrl?: string | null;
  disabled?: boolean;
}

export const SlackButton = ({ environmentId, text = "Continue with Slack", disabled }: SlackButtonProps) => {
  const handleLogin = async () => {
    await signIn("slack", {
      redirect: true,
      callbackUrl: `/api/slack/callback?environment=${environmentId}`, // redirect after login to /
    });
  };

  return (
    <Button type="button" onClick={handleLogin} variant="darkCTA" disabled={disabled}>
      {text}
    </Button>
  );
};
