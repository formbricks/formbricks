"use client";

import { Button } from "@formbricks/ui";
import { signIn } from "next-auth/react";
import { FaSlack } from "react-icons/fa";

export const SlackButton = ({
  environmentId,
  text = "Continue with Slack",
}: {
  environmentId: string;
  text?: string;
  inviteUrl?: string | null;
}) => {
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
