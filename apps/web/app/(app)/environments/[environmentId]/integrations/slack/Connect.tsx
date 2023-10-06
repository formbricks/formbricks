"use client";

import { SlackButton } from "@/components/auth/SlackButton";
import SlackLogo from "@/images/slacklogo.png";
import FormbricksLogo from "@/images/logo.svg";
import { authorize } from "@formbricks/lib/client/google";
import { Button } from "@formbricks/ui";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface ConnectProps {
  enabled: boolean;
  environmentId: string;
  webAppUrl: string;
}

export default function Connect({ enabled }: ConnectProps) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl");

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
        {!enabled && (
          <p className="mb-8 rounded border-gray-200 bg-gray-100 p-3 text-sm">
            Slack Integration is not configured in your instance of Formbricks.
            <br />
            Please follow the{" "}
            <Link href="https://formbricks.com/docs/integrations/slack" className="underline">
              docs
            </Link>{" "}
            to configure it.
          </p>
        )}
        {/*   Connect with Google */}
        <SlackButton inviteUrl={callbackUrl} />
      </div>
    </div>
  );
}
