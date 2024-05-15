"use client";

import { AddChannelMappingModal } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/AddChannelMappingModal";
import { Connect } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/Connect";
import { Home } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/Home";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys";

import { refreshChannelsAction } from "../actions";

interface SlackWrapperProps {
  isEnabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  channelsArray: TIntegrationItem[];
  slackIntegration?: TIntegrationSlack;
  webAppUrl: string;
}

export const SlackWrapper = ({
  isEnabled,
  environment,
  surveys,
  channelsArray,
  slackIntegration,
  webAppUrl,
}: SlackWrapperProps) => {
  const [isConnected, setIsConnected] = useState(slackIntegration ? slackIntegration.config?.key : false);
  const [slackChannels, setSlackChannels] = useState(channelsArray);
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationSlackConfigData & { index: number }) | null
  >(null);

  const refreshChannels = async () => {
    const latestSlackChannels = await refreshChannelsAction(environment.id);
    setSlackChannels(latestSlackChannels);
  };

  return isConnected && slackIntegration ? (
    <>
      <AddChannelMappingModal
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
        refreshChannels={refreshChannels}
      />
    </>
  ) : (
    <Connect isEnabled={isEnabled} environmentId={environment.id} webAppUrl={webAppUrl} />
  );
};
