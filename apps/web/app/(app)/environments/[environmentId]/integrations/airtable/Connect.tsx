"use client";

import AirtableLogo from "@/images/airtable.svg";
import FormbricksLogo from "@/images/logo.svg";
import { Button } from "@formbricks/ui";
import Image from "next/image";
import { useState } from "react";
import ConnectIntegrationModal from "./ConnectIntegrationModal";

interface AirTableConnectProps {
  environmentId: string;
  setIsConnected: (data: boolean) => void;
}

export default function AirTableConnect({ environmentId, setIsConnected }: AirTableConnectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const setOpenWithStates = (isOpen: boolean) => {
    setIsOpen(isOpen);
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

        <Button variant="darkCTA" onClick={() => setIsOpen(true)}>
          Connect with Airtable
        </Button>
      </div>
      <ConnectIntegrationModal
        environmentId={environmentId}
        open={isOpen}
        setOpenWithStates={setOpenWithStates}
        setIsConnected={setIsConnected}
      />
    </div>
  );
}
