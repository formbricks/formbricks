"use client"

import { useState } from 'react';
import Home from "./Home";
import Connect from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/Connect';
import AddIntegrationModal from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/AddIntegrationModal';
import {
    TGoogleSheetIntegration,
    TGoogleSheetsConfigData,
    TGoogleSpreadsheet,
} from '@formbricks/types/v1/integrations';
import { TSurvey } from '@formbricks/types/v1/surveys';

interface GoogleSheetWrapperProps {
    environmentId: string;
    surveys: TSurvey[];
    Spreadsheets: TGoogleSpreadsheet[];
    googleSheetIntegration: TGoogleSheetIntegration;
}

export default function GoogleSheetWrapper({
    environmentId,
    surveys,
    Spreadsheets,
    googleSheetIntegration
}: GoogleSheetWrapperProps) {

    const [isConnected, setIsConnected] = useState(googleSheetIntegration ? googleSheetIntegration.config?.key : false)
    const [isModalOpen, setModalOpen] = useState<boolean>(false);
    const [selectedIntegration, setSelectedIntegration] = useState<TGoogleSheetsConfigData & { index: number } | null>(null);

    return (
        <>
            {isConnected ? (
                <>
                    <AddIntegrationModal
                        environmentId={environmentId}
                        surveys={surveys}
                        open={isModalOpen}
                        setOpen={setModalOpen}
                        spreadsheets={Spreadsheets}
                        googleSheetIntegration={googleSheetIntegration}
                        selectedIntegration={selectedIntegration}
                    />
                    <Home
                        environmentId={environmentId}
                        googleSheetIntegration={googleSheetIntegration}
                        setOpenAddIntegrationModal={setModalOpen}
                        setIsConnected={setIsConnected}
                        setSelectedIntegration={setSelectedIntegration}
                    />
                </>
            ) : (
                <Connect environmentId={environmentId} />
            )}
        </>
    );
}

