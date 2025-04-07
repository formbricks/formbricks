"use client";

import { Button } from "@/modules/ui/components/button";
import { FormbricksLogo } from "@/modules/ui/components/formbricks-logo";
import { useTranslate } from "@tolgee/react";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TIntegrationType } from "@formbricks/types/integration";
import { getIntegrationDetails } from "./lib/utils";

interface ConnectIntegrationProps {
  isEnabled: boolean;
  integrationType: TIntegrationType;
  handleAuthorization: () => void;
  integrationLogoSrc: string | StaticImageData;
}

export const ConnectIntegration = ({
  isEnabled,
  integrationType,
  handleAuthorization,
  integrationLogoSrc,
}: ConnectIntegrationProps) => {
  const { t } = useTranslate();
  const [isConnecting, setIsConnecting] = useState(false);
  const searchParams = useSearchParams();
  const integrationDetails = getIntegrationDetails(integrationType, t);
  const handleConnect = () => {
    try {
      setIsConnecting(true);
      handleAuthorization();
    } catch (error) {
      console.error(error);
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const error = searchParams?.get("error");
    if (error) {
      toast.error(t("environments.integrations.connecting_integration_failed_please_try_again"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-[75vh] w-full items-center justify-center">
      <div className="flex w-1/2 flex-col items-center justify-center rounded-lg bg-white p-8 shadow-sm">
        <div className="flex w-1/2 justify-center -space-x-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white p-6 shadow-md">
            <FormbricksLogo />
          </div>
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white p-4 shadow-md">
            <Image className="w-1/2" src={integrationLogoSrc} alt="logo" />
          </div>
        </div>
        <p className="my-8">{integrationDetails?.text}</p>
        {!isEnabled && (
          <p className="mb-8 rounded-sm border-slate-200 bg-slate-100 p-3 text-sm">
            {integrationDetails?.notConfiguredText}
            <br />
            {t("common.follow_these")}{" "}
            <Link href={integrationDetails?.docsLink ?? ""} className="underline">
              {t("common.docs")}
            </Link>{" "}
            {t("environments.integrations.to_configure_it")}.
          </p>
        )}
        <Button loading={isConnecting} onClick={handleConnect} disabled={!isEnabled}>
          {integrationDetails?.connectButtonLabel}
        </Button>
      </div>
    </div>
  );
};
