"use client";

import AddSlackConnectionModal from "@/app/(app)/environments/[environmentId]/integrations/slack/AddIntegrationModal";
import Connect from "@/app/(app)/environments/[environmentId]/integrations/slack/Connect";
import Home from "@/app/(app)/environments/[environmentId]/integrations/slack/Home";
// import { TEnvironment } from "@formbricks/types/v1/environment";
// import { TSlackChannel, TSlackConfigData, TSlackIntegration } from "@formbricks/types/v1/integrations";
// import { TSurvey } from "@formbricks/types/v1/surveys";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TSlackChannel, TSlackConfigData, TSlackIntegration } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys";

interface SlackWrapperProps {
  enabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  channels: TSlackChannel[];
  environmentId: string;
  slackIntegration: TSlackIntegration | undefined;
  webAppUrl: string;
}

export default function SlackWrapper({
  enabled,
  environment,
  environmentId,
  surveys,
  channels,
  slackIntegration,
  webAppUrl,
}: SlackWrapperProps) {
  const [isConnected, setIsConnected] = useState(slackIntegration ? slackIntegration.config?.key : false);
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TSlackConfigData & { index: number }) | null
  >(null);

  const refreshSheet = async () => {
    console.log("refreshing connections");
  };

  return isConnected && slackIntegration ? (
    <>
      {/* <AddSlackConnectionModal */}
      {/*   environmentId={environment.id} */}
      {/*   surveys={surveys} */}
      {/*   open={isModalOpen} */}
      {/*   setOpen={setModalOpen} */}
      {/*   channels={channels} */}
      {/*   slackIntegration={slackIntegration} */}
      {/*   selectedIntegration={selectedIntegration} */}
      {/* /> */}
      {/* <Home */}
      {/*   environment={environment} */}
      {/*   slackIntegration={slackIntegration} */}
      {/*   setOpenAddIntegrationModal={setModalOpen} */}
      {/*   setIsConnected={setIsConnected} */}
      {/*   setSelectedIntegration={setSelectedIntegration} */}
      {/*   refreshSheet={refreshSheet} */}
      {/* /> */}
      <Connect enabled={enabled} environmentId={environmentId} webAppUrl={webAppUrl} />
    </>
  ) : (
    <Connect enabled={enabled} environmentId={environmentId} webAppUrl={webAppUrl} />
  );
}
