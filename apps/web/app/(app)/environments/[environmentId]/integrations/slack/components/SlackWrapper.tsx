"use client";

import { getSlackChannelsAction } from "@/app/(app)/environments/[environmentId]/integrations/slack/actions";
import { AddChannelMappingModal } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/AddChannelMappingModal";
import { ManageIntegration } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/ManageIntegration";
import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/slack/lib/slack";
import slackLogo from "@/images/slacklogo.png";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";
import { useEffect, useState } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationSlack, TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface SlackWrapperProps {
  isEnabled: boolean;
  environment: TEnvironment;
  surveys: TSurvey[];
  slackIntegration?: TIntegrationSlack;
  webAppUrl: string;
  attributeClasses: TAttributeClass[];
  locale: TUserLocale;
}

export const SlackWrapper = ({
  isEnabled,
  environment,
  surveys,
  slackIntegration,
  webAppUrl,
  attributeClasses,
  locale,
}: SlackWrapperProps) => {
  const [isConnected, setIsConnected] = useState(slackIntegration ? slackIntegration.config?.key : false);
  const [slackChannels, setSlackChannels] = useState<TIntegrationItem[]>([]);
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [showReconnectButton, setShowReconnectButton] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationSlackConfigData & { index: number }) | null
  >(null);

  const getSlackChannels = async () => {
    const getSlackChannelsResponse = await getSlackChannelsAction({ environmentId: environment.id });

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
  };

  useEffect(() => {
    getSlackChannels();
  }, []);

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
        attributeClasses={attributeClasses}
      />
      <ManageIntegration
        environment={environment}
        slackIntegration={slackIntegration}
        setOpenAddIntegrationModal={setModalOpen}
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
