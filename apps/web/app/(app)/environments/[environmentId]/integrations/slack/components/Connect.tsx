"use client";

import FormbricksLogo from "@/images/logo.svg";
import SlackLogo from "@/images/slacklogo.png";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";

import { authorize } from "../lib/slack";

interface ConnectProps {
  isEnabled: boolean;
  environmentId: string;
  webAppUrl: string;
}

export const Connect = ({ isEnabled, environmentId, webAppUrl }: ConnectProps) => {
  const searchParams = useSearchParams();

  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const error = searchParams?.get("error");
    if (error) {
      toast.error("Connecting integration failed. Please try again!");
    }
  }, [searchParams]);

  const handleAuthorizeSlack = async () => {
    setIsConnecting(true);
    authorize(environmentId, webAppUrl).then((url: string) => {
      if (url) {
        window.location.replace(url);
      }
    });
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-1/2 flex-col items-center justify-center rounded-lg bg-white p-8 shadow">
        <div className="flex w-1/2 justify-center -space-x-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white p-4 shadow-md">
            <Image className="w-1/2" src={FormbricksLogo} alt="Formbricks Logo" />
          </div>
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white p-4 shadow-md">
            <Image className="w-1/2" src={SlackLogo} alt="Slack logo" />
          </div>
        </div>
        <p className="my-8">Send responses directly to Slack.</p>
        {!isEnabled && (
          <p className="mb-8 rounded border-gray-200 bg-gray-100 p-3 text-sm">
            Slack Integration is not configured in your instance of Formbricks.
            <br />
            Please follow the{" "}
            <Link href="https://formbricks.com/docs/self-hosting/integrations#slack" className="underline">
              docs
            </Link>{" "}
            to configure it.
          </p>
        )}
        <Button variant="darkCTA" loading={isConnecting} onClick={handleAuthorizeSlack} disabled={!isEnabled}>
          Connect with Slack
        </Button>
      </div>
    </div>
  );
};
