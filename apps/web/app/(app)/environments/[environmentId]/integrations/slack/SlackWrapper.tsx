"use client";

import AddSlackConnectionModal from "@/app/(app)/environments/[environmentId]/integrations/slack/AddIntegrationModal";
import Connect from "@/app/(app)/environments/[environmentId]/integrations/slack/Connect";
import Home from "@/app/(app)/environments/[environmentId]/integrations/slack/Home";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TSlackConfigData, TSlackIntegration } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys";

import { refreshChannelAction } from "./actions";

interface SlackWrapperProps {
  enabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  channelsArray: TIntegrationItem[];
  slackIntegration?: TSlackIntegration;
  webAppUrl: string;
}

export default function SlackWrapper({
  enabled,
  environment,
  surveys,
  channelsArray,
  slackIntegration,
  webAppUrl,
}: SlackWrapperProps) {
  const [isConnected, setIsConnected] = useState(slackIntegration ? slackIntegration.config?.key : false);
  const [slackChannels, setSlackChannels] = useState(channelsArray);
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TSlackConfigData & { index: number }) | null
  >(null);

  const refreshSheet = async () => {
    const latestSlackChannels = await refreshChannelAction(environment.id);
    setSlackChannels(latestSlackChannels);
  };

  console.log("is conneeeeeeected!!!!!!!!", isConnected);
  return isConnected && slackIntegration ? (
    <>
      <AddSlackConnectionModal
        environmentId={environment.id}
        surveys={surveys}
        open={isModalOpen}
        setOpen={setModalOpen}
        channels={slackChannels}
        slackIntegration={slackIntegration}
        selectedIntegration={selectedIntegration}
      />
      <Home
        environment={environment}
        slackIntegration={slackIntegration}
        setOpenAddIntegrationModal={setModalOpen}
        setIsConnected={setIsConnected}
        setSelectedIntegration={setSelectedIntegration}
        refreshSheet={refreshSheet}
      />
    </>
  ) : (
    <Connect enabled={enabled} environmentId={environment.id} webAppUrl={webAppUrl} />
  );
}
