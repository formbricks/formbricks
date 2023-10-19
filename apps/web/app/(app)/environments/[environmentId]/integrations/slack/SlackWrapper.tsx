"use client";

import Connect from "@/app/(app)/environments/[environmentId]/integrations/slack/Connect";
import Home from "@/app/(app)/environments/[environmentId]/integrations/slack/Home";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TSlackConfigData, TSlackIntegration } from "@formbricks/types/v1/integrations";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useState } from "react";

interface SlackWrapperProps {
  enabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  environmentId: string;
  slackIntegration: TSlackIntegration | undefined;
  webAppUrl: string;
}

export default async function SlackWrapper({
  enabled,
  environment,
  environmentId,
  surveys,
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
    <Home
      environment={environment}
      slackIntegration={slackIntegration}
      setOpenAddIntegrationModal={setModalOpen}
      setIsConnected={setIsConnected}
      setSelectedIntegration={setSelectedIntegration}
      refreshSheet={refreshSheet}
    />
  ) : (
    <Connect enabled={enabled} environmentId={environmentId} webAppUrl={webAppUrl} />
  );
}
