"use client";

import { useCallback, useEffect, useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { validateGoogleSheetsConnectionAction } from "@/app/(app)/environments/[environmentId]/workspace/integrations/google-sheets/actions";
import { ManageIntegration } from "@/app/(app)/environments/[environmentId]/workspace/integrations/google-sheets/components/ManageIntegration";
import { authorize } from "@/app/(app)/environments/[environmentId]/workspace/integrations/google-sheets/lib/google";
import googleSheetLogo from "@/images/googleSheetsLogo.png";
import { GOOGLE_SHEET_INTEGRATION_INVALID_GRANT } from "@/lib/googleSheet/constants";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";
import { AddIntegrationModal } from "./AddIntegrationModal";

interface GoogleSheetWrapperProps {
  isEnabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  googleSheetIntegration?: TIntegrationGoogleSheets;
  webAppUrl: string;
  locale: TUserLocale;
}

export const GoogleSheetWrapper = ({
  isEnabled,
  environment,
  surveys,
  googleSheetIntegration,
  webAppUrl,
  locale,
}: GoogleSheetWrapperProps) => {
  const [isConnected, setIsConnected] = useState(
    googleSheetIntegration ? googleSheetIntegration.config?.key : false
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showReconnectButton, setShowReconnectButton] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationGoogleSheetsConfigData & { index: number }) | null
  >(null);

  const validateConnection = useCallback(async () => {
    if (!isConnected || !googleSheetIntegration) return;
    const response = await validateGoogleSheetsConnectionAction({ environmentId: environment.id });
    if (response?.serverError === GOOGLE_SHEET_INTEGRATION_INVALID_GRANT) {
      setShowReconnectButton(true);
    }
  }, [environment.id, isConnected, googleSheetIntegration]);

  useEffect(() => {
    validateConnection();
  }, [validateConnection]);

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
            setOpen={setIsModalOpen}
            googleSheetIntegration={googleSheetIntegration}
            selectedIntegration={selectedIntegration}
          />
          <ManageIntegration
            googleSheetIntegration={googleSheetIntegration}
            setOpenAddIntegrationModal={setIsModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
            showReconnectButton={showReconnectButton}
            handleGoogleAuthorization={handleGoogleAuthorization}
            locale={locale}
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
