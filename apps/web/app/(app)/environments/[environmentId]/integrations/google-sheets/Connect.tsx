import GoogleSheetLogo from "@/images/google-sheets-small.png";
import FormbricksLogo from "@/images/logo.svg";
import { authorize } from "@formbricks/lib/client/google";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { Button } from "@formbricks/ui";
import Image from "next/image";
import { useState } from "react";

export default function Connect({ environmentId }: { environmentId: string }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const handleGoogleLogin = async () => {
    setIsConnecting(true);
    authorize(environmentId, WEBAPP_URL).then((url: string) => {
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
            <Image className="w-1/2" src={GoogleSheetLogo} alt="Google Sheet logo" />
          </div>
        </div>
        <p className="my-8">Sync responses directly with Google Sheets.</p>
        <Button variant="darkCTA" loading={isConnecting} onClick={handleGoogleLogin}>
          Connect with Google
        </Button>
      </div>
    </div>
  );
}
