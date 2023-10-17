"use client";

import AirtableLogo from "../images/airtable.svg";
import FormbricksLogo from "@/images/logo.svg";
import { Button } from "@formbricks/ui/Button";
import Image from "next/image";
import { useState } from "react";
import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable";

interface AirTableConnectProps {
  enabled: boolean;
  environmentId: string;
  webAppUrl: string;
}

export default function AirTableConnect({ environmentId, enabled, webAppUrl }: AirTableConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const handleGoogleLogin = async () => {
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
            <Image className="w-1/2" src={AirtableLogo} alt="Airtable Logo" />
          </div>
        </div>
        <p className="my-8">Sync responses directly with Airtable.</p>

        <Button variant="darkCTA" loading={isConnecting} onClick={handleGoogleLogin} disabled={!enabled}>
          Connect with Airtable
        </Button>
      </div>
    </div>
  );
}
