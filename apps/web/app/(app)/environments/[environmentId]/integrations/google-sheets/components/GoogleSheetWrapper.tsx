"use client";

import { refreshSheetAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
} from "@formbricks/types/integration/googleSheet";
import { TSurvey } from "@formbricks/types/surveys";

import AddIntegrationModal from "./AddIntegrationModal";
import Connect from "./Connect";
import Home from "./Home";

interface GoogleSheetWrapperProps {
  enabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  spreadSheetArray: TIntegrationItem[];
  googleSheetIntegration?: TIntegrationGoogleSheets;
  webAppUrl: string;
}

export default function GoogleSheetWrapper({
  enabled,
  environment,
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
    (TIntegrationGoogleSheetsConfigData & { index: number }) | null
  >(null);

  const refreshSheet = async () => {
    const latestSpreadsheets = await refreshSheetAction(environment.id);
    setSpreadsheets(latestSpreadsheets);
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
            spreadsheets={spreadsheets}
            googleSheetIntegration={googleSheetIntegration}
            selectedIntegration={selectedIntegration}
          />
          <Home
            environment={environment}
            googleSheetIntegration={googleSheetIntegration}
            setOpenAddIntegrationModal={setModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
            refreshSheet={refreshSheet}
          />
        </>
      ) : (
        <Connect enabled={enabled} environmentId={environment.id} webAppUrl={webAppUrl} />
      )}
    </>
  );
}
