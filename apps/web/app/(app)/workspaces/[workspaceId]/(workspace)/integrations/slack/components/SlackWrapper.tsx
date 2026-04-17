"use client";

import { useCallback, useEffect, useState } from "react";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getSlackChannelsAction } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/slack/actions";
import { AddChannelMappingModal } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/slack/components/AddChannelMappingModal";
import { ManageIntegration } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/slack/components/ManageIntegration";
import { authorize } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/slack/lib/slack";
import slackLogo from "@/images/slacklogo.png";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";

interface SlackWrapperProps {
  isEnabled: boolean;
  workspaceId: string;
  surveys: TSurvey[];
  slackIntegration?: TIntegrationSlack;
  webAppUrl: string;
  locale: TUserLocale;
}

export const SlackWrapper = ({
  isEnabled,
  workspaceId,
  surveys,
  slackIntegration,
  webAppUrl,
  locale,
}: SlackWrapperProps) => {
  const [isConnected, setIsConnected] = useState(slackIntegration ? !!slackIntegration.config?.key : false);
  const [slackChannels, setSlackChannels] = useState<TIntegrationItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showReconnectButton, setShowReconnectButton] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationSlackConfigData & { index: number }) | null
  >(null);

  const getSlackChannels = useCallback(async () => {
    const getSlackChannelsResponse = await getSlackChannelsAction({ workspaceId });

    if (
      getSlackChannelsResponse?.serverError &&
      (getSlackChannelsResponse.serverError.includes("missing_scope") ||
        getSlackChannelsResponse.serverError.includes("invalid_auth"))
    ) {
      setShowReconnectButton(true);
    }

    if (getSlackChannelsResponse?.data) {
      setSlackChannels(getSlackChannelsResponse.data);
    }
  }, [workspaceId]);

  useEffect(() => {
    getSlackChannels();
  }, [getSlackChannels]);

  const handleSlackAuthorization = async () => {
    authorize(workspaceId, webAppUrl).then((url: string) => {
      if (url) {
        window.location.replace(url);
      }
    });
  };

  return isConnected && slackIntegration ? (
    <>
      <AddChannelMappingModal
        workspaceId={workspaceId}
        surveys={surveys}
        open={isModalOpen}
        setOpen={setIsModalOpen}
        channels={slackChannels}
        slackIntegration={slackIntegration}
        selectedIntegration={selectedIntegration}
      />
      <ManageIntegration
        slackIntegration={slackIntegration}
        setOpenAddIntegrationModal={setIsModalOpen}
        setIsConnected={setIsConnected}
        setSelectedIntegration={setSelectedIntegration}
        refreshChannels={getSlackChannels}
        showReconnectButton={showReconnectButton}
        handleSlackAuthorization={handleSlackAuthorization}
        locale={locale}
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
