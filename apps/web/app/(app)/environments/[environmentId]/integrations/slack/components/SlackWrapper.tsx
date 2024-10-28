"use client";

import { refreshChannelsAction } from "@/app/(app)/environments/[environmentId]/integrations/slack/actions";
import { AddChannelMappingModal } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/AddChannelMappingModal";
import { ManageIntegration } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/ManageIntegration";
import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/slack/lib/slack";
import slackLogo from "@/images/slacklogo.png";
import { useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ConnectIntegration } from "@formbricks/ui/components/ConnectIntegration";

interface SlackWrapperProps {
  isEnabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  channelsArray: TIntegrationItem[];
  slackIntegration?: TIntegrationSlack;
  webAppUrl: string;
  contactAttributeKeys: TContactAttributeKey[];
}

export const SlackWrapper = ({
  isEnabled,
  environment,
  surveys,
  channelsArray,
  slackIntegration,
  webAppUrl,
  contactAttributeKeys,
}: SlackWrapperProps) => {
  const [isConnected, setIsConnected] = useState(slackIntegration ? slackIntegration.config?.key : false);
  const [slackChannels, setSlackChannels] = useState(channelsArray);
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationSlackConfigData & { index: number }) | null
  >(null);

  const refreshChannels = async () => {
    const refreshChannelsResponse = await refreshChannelsAction({ environmentId: environment.id });

    if (refreshChannelsResponse?.data) {
      setSlackChannels(refreshChannelsResponse.data);
    }
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
        contactAttributeKeys={contactAttributeKeys}
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
