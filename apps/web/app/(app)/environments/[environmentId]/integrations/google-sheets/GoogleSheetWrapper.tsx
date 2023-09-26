"use client";

import { useState } from "react";
import Home from "./Home";
import Connect from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/Connect";
import AddIntegrationModal from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/AddIntegrationModal";
import {
  TGoogleSheetIntegration,
  TGoogleSheetsConfigData,
  TGoogleSpreadsheet,
} from "@formbricks/types/v1/integrations";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { refreshSheetAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";

interface GoogleSheetWrapperProps {
  enabled: boolean;
  environmentId: string;
  surveys: TSurvey[];
  spreadSheetArray: TGoogleSpreadsheet[];
  googleSheetIntegration: TGoogleSheetIntegration | undefined;
  webAppUrl: string;
}

export default function GoogleSheetWrapper({
  enabled,
  environmentId,
  surveys,
  spreadSheetArray,
  googleSheetIntegration,
  webAppUrl,
}: GoogleSheetWrapperProps) {
  const [isConnected, setIsConnected] = useState(
    googleSheetIntegration ? googleSheetIntegration.config?.key : false
  );
  const [spreadsheets, setSpreadsheets] = useState(spreadSheetArray);
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TGoogleSheetsConfigData & { index: number }) | null
  >(null);

  const refreshSheet = async () => {
    const latestSpreadsheets = await refreshSheetAction(environmentId);
    setSpreadsheets(latestSpreadsheets);
  };

  return (
    <>
      {isConnected && googleSheetIntegration ? (
        <>
          <AddIntegrationModal
            environmentId={environmentId}
            surveys={surveys}
            open={isModalOpen}
            setOpen={setModalOpen}
            spreadsheets={spreadsheets}
            googleSheetIntegration={googleSheetIntegration}
            selectedIntegration={selectedIntegration}
          />
          <Home
            environmentId={environmentId}
            googleSheetIntegration={googleSheetIntegration}
            setOpenAddIntegrationModal={setModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
            refreshSheet={refreshSheet}
          />
        </>
      ) : (
        <Connect enabled={enabled} environmentId={environmentId} webAppUrl={webAppUrl} />
      )}
    </>
  );
}
