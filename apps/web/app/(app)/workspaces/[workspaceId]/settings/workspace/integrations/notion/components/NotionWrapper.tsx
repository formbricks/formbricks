"use client";

import { useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import {
  TIntegrationNotion,
  TIntegrationNotionConfigData,
  TIntegrationNotionDatabase,
} from "@formbricks/types/integration/notion";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { AddIntegrationModal } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/notion/components/AddIntegrationModal";
import { ManageIntegration } from "@/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/notion/components/ManageIntegration";
import notionLogo from "@/images/notion.png";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";
import { authorize } from "../lib/notion";

interface NotionWrapperProps {
  notionIntegration: TIntegrationNotion | undefined;
  enabled: boolean;
  workspaceId: string;
  webAppUrl: string;
  surveys: TSurvey[];
  databasesArray: TIntegrationNotionDatabase[];
  locale: TUserLocale;
  contactAttributeKeys: TContactAttributeKey[];
}

export const NotionWrapper = ({
  notionIntegration,
  enabled,
  workspaceId,
  webAppUrl,
  surveys,
  databasesArray,
  locale,
  contactAttributeKeys,
}: NotionWrapperProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(
    notionIntegration ? !!notionIntegration.config.key?.bot_id : false
  );
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationNotionConfigData & { index: number }) | null
  >(null);

  const handleNotionAuthorization = async () => {
    authorize(workspaceId, webAppUrl).then((url: string) => {
      if (url) {
        window.location.replace(url);
      }
    });
  };

  return (
    <>
      {isConnected && notionIntegration ? (
        <>
          <AddIntegrationModal
            workspaceId={workspaceId}
            surveys={surveys}
            open={isModalOpen}
            setOpen={setIsModalOpen}
            notionIntegration={notionIntegration}
            databases={databasesArray}
            selectedIntegration={selectedIntegration}
            contactAttributeKeys={contactAttributeKeys}
          />
          <ManageIntegration
            notionIntegration={notionIntegration}
            setOpenAddIntegrationModal={setIsModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
            locale={locale}
            handleNotionAuthorization={handleNotionAuthorization}
          />
        </>
      ) : (
        <ConnectIntegration
          isEnabled={enabled}
          integrationType={"notion"}
          handleAuthorization={handleNotionAuthorization}
          integrationLogoSrc={notionLogo}
        />
      )}
    </>
  );
};
