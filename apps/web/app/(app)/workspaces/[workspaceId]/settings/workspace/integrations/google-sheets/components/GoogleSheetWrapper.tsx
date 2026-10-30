"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ManageIntegration } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/google-sheets/components/ManageIntegration";
import { authorize } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/google-sheets/lib/google";
import { getGoogleSheetsConnection } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/lib/api-client";
import googleSheetLogo from "@/images/googleSheetsLogo.png";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";
import { AddIntegrationModal } from "./AddIntegrationModal";

interface GoogleSheetWrapperProps {
  isEnabled: boolean;
  workspaceId: string;
  surveys: TSurvey[];
  surveyVisibilityEnabled: boolean;
  googleSheetIntegration?: TIntegrationGoogleSheets;
  webAppUrl: string;
  locale: TUserLocale;
}

export const GoogleSheetWrapper = ({
  isEnabled,
  workspaceId,
  surveys,
  surveyVisibilityEnabled,
  googleSheetIntegration,
  webAppUrl,
  locale,
}: Readonly<GoogleSheetWrapperProps>) => {
  const [isConnected, setIsConnected] = useState(
    googleSheetIntegration ? googleSheetIntegration.config?.key : false
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showReconnectButton, setShowReconnectButton] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationGoogleSheetsConfigData & { index: number }) | null
  >(null);

  // Depend only on stable values (workspaceId is a primitive; isConnected is local state), never on the
  // server-derived `googleSheetIntegration` object: a route refresh hands this component a new reference,
  // and depending on it would re-run the check on every one. `isConnected` already implies an
  // integration exists, and the check only needs `workspaceId`.
  const validateConnection = useCallback(async () => {
    if (!isConnected) return;
    try {
      if ((await getGoogleSheetsConnection(workspaceId)) === "reauthorization_required") {
        setShowReconnectButton(true);
      }
    } catch {
      // Best effort: a failed check leaves the page as it is, as it always did.
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
            surveyVisibilityEnabled={surveyVisibilityEnabled}
            open={isModalOpen}
            setOpen={setIsModalOpen}
            googleSheetIntegration={googleSheetIntegration}
            selectedIntegration={selectedIntegration}
          />
          <ManageIntegration
            googleSheetIntegration={googleSheetIntegration}
            surveys={surveys}
            surveyVisibilityEnabled={surveyVisibilityEnabled}
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
