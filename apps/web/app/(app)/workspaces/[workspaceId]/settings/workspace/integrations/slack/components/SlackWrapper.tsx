"use client";

import { useCallback, useEffect, useState } from "react";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getSlackChannels as fetchSlackChannels } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/lib/api-client";
import { AddChannelMappingModal } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/slack/components/AddChannelMappingModal";
import { ManageIntegration } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/slack/components/ManageIntegration";
import { authorize } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/slack/lib/slack";
import slackLogo from "@/images/slacklogo.png";
import { getV3ApiErrorReason } from "@/modules/api/lib/v3-client";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";

interface SlackWrapperProps {
  isEnabled: boolean;
  workspaceId: string;
  surveys: TSurvey[];
  surveyVisibilityEnabled: boolean;
  slackIntegration?: TIntegrationSlack;
  webAppUrl: string;
  locale: TUserLocale;
}

export const SlackWrapper = ({
  isEnabled,
  workspaceId,
  surveys,
  surveyVisibilityEnabled,
  slackIntegration,
  webAppUrl,
  locale,
}: Readonly<SlackWrapperProps>) => {
  const [isConnected, setIsConnected] = useState(slackIntegration ? !!slackIntegration.config?.key : false);
  const [slackChannels, setSlackChannels] = useState<TIntegrationItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showReconnectButton, setShowReconnectButton] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationSlackConfigData & { index: number }) | null
  >(null);

  const getSlackChannels = useCallback(async () => {
    try {
      setSlackChannels(await fetchSlackChannels(workspaceId));
    } catch (error) {
      if (getV3ApiErrorReason(error) === "reauthorization_required") setShowReconnectButton(true);
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
        surveyVisibilityEnabled={surveyVisibilityEnabled}
        open={isModalOpen}
        setOpen={setIsModalOpen}
        channels={slackChannels}
        slackIntegration={slackIntegration}
        selectedIntegration={selectedIntegration}
      />
      <ManageIntegration
        slackIntegration={slackIntegration}
        surveys={surveys}
        surveyVisibilityEnabled={surveyVisibilityEnabled}
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
