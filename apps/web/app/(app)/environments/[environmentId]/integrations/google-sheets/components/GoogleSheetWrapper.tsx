"use client";

import { ManageIntegration } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/ManageIntegration";
import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/lib/google";
import googleSheetLogo from "@/images/googleSheetsLogo.png";
import { useState } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ConnectIntegration } from "@formbricks/ui/ConnectIntegration";
import { AddIntegrationModal } from "./AddIntegrationModal";

interface GoogleSheetWrapperProps {
  isEnabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  googleSheetIntegration?: TIntegrationGoogleSheets;
  webAppUrl: string;
  attributeClasses: TAttributeClass[];
}

export const GoogleSheetWrapper = ({
  isEnabled,
  environment,
  surveys,
  googleSheetIntegration,
  webAppUrl,
  attributeClasses,
}: GoogleSheetWrapperProps) => {
  const [isConnected, setIsConnected] = useState(
    googleSheetIntegration ? googleSheetIntegration.config?.key : false
  );
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationGoogleSheetsConfigData & { index: number }) | null
  >(null);

  const handleGoogleAuthorization = async () => {
    authorize(environment.id, webAppUrl).then((url: string) => {
      if (url) {
        window.location.replace(url);
      }
    });
  };

  return (
    <>
      {isConnected && googleSheetIntegration ? (
        <>
          <AddIntegrationModal
            environmentId={environment.id}
            surveys={surveys}
            open={isModalOpen}
            setOpen={setModalOpen}
            googleSheetIntegration={googleSheetIntegration}
            selectedIntegration={selectedIntegration}
            attributeClasses={attributeClasses}
          />
          <ManageIntegration
            environment={environment}
            googleSheetIntegration={googleSheetIntegration}
            setOpenAddIntegrationModal={setModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
          />
        </>
      ) : (
        <ConnectIntegration
          isEnabled={isEnabled}
          integrationType={"googleSheets"}
          handleAuthorization={handleGoogleAuthorization}
          integrationLogoSrc={googleSheetLogo}
        />
      )}
    </>
  );
};
