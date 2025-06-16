"use client";

import PlainLogo from "@/images/plain.webp";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";
import { TIntegrationPlain } from "@formbricks/types/integration/plain";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { AddIntegrationModal } from "./AddIntegrationModal";
import { AddKeyModal } from "./AddKeyModal";
import { ManageIntegration } from "./ManageIntegration";

interface PlainWrapperProps {
  plainIntegration: TIntegrationPlain | undefined;
  enabled: boolean;
  environment: TEnvironment;
  webAppUrl: string;
  surveys: TSurvey[];
  databasesArray: any[];
  locale: TUserLocale;
}

export const PlainWrapper = ({
  plainIntegration,
  enabled,
  environment,
  webAppUrl,
  surveys,
  locale,
}: PlainWrapperProps) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(plainIntegration ? plainIntegration.config.key : false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationPlainConfigData & { index: number }) | null
  >(null);

  const handlePlainAuthorization = async () => {
    setOpen(true);
  };

  // Debug the plainIntegration object
  console.log("Plain Integration:", plainIntegration);

  return (
    <>
      {isConnected && plainIntegration ? (
        <>
          <AddIntegrationModal
            environmentId={environment.id}
            surveys={surveys}
            open={isModalOpen}
            setOpen={setModalOpen}
            plainIntegration={plainIntegration}
            databases={[]}
            selectedIntegration={selectedIntegration}
          />
          <ManageIntegration
            environment={environment}
            plainIntegration={plainIntegration}
            setOpenAddIntegrationModal={setModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
            locale={locale}
            handlePlainAuthorization={handlePlainAuthorization}
          />
        </>
      ) : (
        <>
          <AddKeyModal environmentId={environment.id} open={open} setOpen={setOpen} />
          <ConnectIntegration
            isEnabled={enabled}
            integrationType={"plain"}
            handleAuthorization={handlePlainAuthorization}
            integrationLogoSrc={PlainLogo}
          />
        </>
      )}
    </>
  );
};
