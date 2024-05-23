"use client";

import { refreshChannelsAction } from "@/app/(app)/environments/[environmentId]/integrations/slack/actions";
import { AddChannelMappingModal } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/AddChannelMappingModal";
import { ManageIntegration } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/ManageIntegration";
import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/slack/lib/slack";
import slackLogo from "@/images/slacklogo.png";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys";
import { ConnectIntegration } from "@formbricks/ui/ConnectIntegration";

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

  const handleSlackAuthorization = async () => {
    authorize(environment.id, webAppUrl).then((url: string) => {
      if (url) {
        window.location.replace(url);
      }
    });
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
      <ManageIntegration
        environment={environment}
        slackIntegration={slackIntegration}
        setOpenAddIntegrationModal={setModalOpen}
        setIsConnected={setIsConnected}
        setSelectedIntegration={setSelectedIntegration}
        refreshChannels={refreshChannels}
      />
    </>
  ) : (
    <ConnectIntegration
      isEnabled={isEnabled}
      integrationType={"slack"}
      handleAuthorization={handleSlackAuthorization}
      integrationLogoSrc={slackLogo}
    />
  );
};
