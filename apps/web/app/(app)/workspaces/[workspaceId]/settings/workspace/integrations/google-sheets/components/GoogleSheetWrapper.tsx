"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { validateGoogleSheetsConnectionAction } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/google-sheets/actions";
import { ManageIntegration } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/google-sheets/components/ManageIntegration";
import { authorize } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/google-sheets/lib/google";
import googleSheetLogo from "@/images/googleSheetsLogo.png";
import { GOOGLE_SHEET_INTEGRATION_INVALID_GRANT } from "@/lib/googleSheet/constants";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";
import { AddIntegrationModal } from "./AddIntegrationModal";

interface GoogleSheetWrapperProps {
  isEnabled: boolean;
  workspaceId: string;
  surveys: TSurvey[];
  googleSheetIntegration?: TIntegrationGoogleSheets;
  webAppUrl: string;
  locale: TUserLocale;
}

export const GoogleSheetWrapper = ({
  isEnabled,
  workspaceId,
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

  // Depend only on stable values (workspaceId is a primitive; isConnected is local state). The
  // server-derived `googleSheetIntegration` object must NOT be a dependency: every authenticated
  // server action re-sets the Better Auth session cookie, which refreshes the route and hands this
  // component a new `googleSheetIntegration` reference — depending on it would re-fire the action in
  // an infinite loop. `isConnected` already implies an integration exists, and the action only needs
  // `workspaceId`, so the object isn't needed here.
  const validateConnection = useCallback(async () => {
    if (!isConnected) return;
    const response = await validateGoogleSheetsConnectionAction({ workspaceId });
    if (response?.serverError === GOOGLE_SHEET_INTEGRATION_INVALID_GRANT) {
      setShowReconnectButton(true);
    }
  }, [workspaceId, isConnected]);

  useEffect(() => {
    validateConnection();
  }, [validateConnection]);

  const handleGoogleAuthorization = async () => {
    authorize(workspaceId, webAppUrl).then((url: string) => {
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
            workspaceId={workspaceId}
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
