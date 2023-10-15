"use client";

import Home from "@/app/(app)/environments/[environmentId]/integrations/notion/Home";
import AddIntegrationModal from "@/app/(app)/environments/[environmentId]/integrations/notion/AddIntegrationModal";
import Connect from "@/app/(app)/environments/[environmentId]/integrations/notion/Connect";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TNotionConfigData, TNotionDatabase, TNotionIntegration } from "@formbricks/types/v1/integrations";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useState } from "react";

interface NotionWrapperProps {
  notionIntegration: TNotionIntegration | undefined;
  enabled: boolean;
  environment: TEnvironment;
  webAppUrl: string;
  surveys: TSurvey[];
  databasesArray: TNotionDatabase[];
}

export default function NotionWrapper({
  notionIntegration,
  enabled,
  environment,
  webAppUrl,
  surveys,
  databasesArray,
}: NotionWrapperProps) {
  const [isModalOpen, setModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(
    notionIntegration ? notionIntegration.config.key?.bot_id : false
  );
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TNotionConfigData & { index: number }) | null
  >(null);

  const refreshDatabase = async () => {
    // const latestDatabases = await refreshDatabasesAction(environment.id);
    // setDatabases(latestDatabases);
  };

  return (
    <>
      {isConnected && notionIntegration ? (
        <>
          <AddIntegrationModal
            environmentId={environment.id}
            surveys={surveys}
            open={isModalOpen}
            setOpen={setModalOpen}
            notionIntegration={notionIntegration}
            databases={databasesArray}
            selectedIntegration={selectedIntegration}
          />
          <Home
            environment={environment}
            notionIntegration={notionIntegration}
            setOpenAddIntegrationModal={setModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
            refreshDatabase={refreshDatabase}
          />
        </>
      ) : (
        <Connect enabled={enabled} environmentId={environment.id} webAppUrl={webAppUrl} />
      )}
    </>
  );
}
