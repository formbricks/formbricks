"use client";

import { AddIntegrationModal } from "@/app/(app)/environments/[environmentId]/integrations/notion/components/AddIntegrationModal";
import { ManageIntegration } from "@/app/(app)/environments/[environmentId]/integrations/notion/components/ManageIntegration";
import PlainLogo from "@/images/plain.webp";
import { ConnectIntegration } from "@/modules/ui/components/connect-integration";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import {
  TIntegrationNotion,
  TIntegrationNotionConfigData,
  TIntegrationNotionDatabase,
} from "@formbricks/types/integration/notion";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { authorize } from "../../notion/lib/notion";
import { AddKeyModal } from "./AddKeyModal";

interface NotionWrapperProps {
  notionIntegration: TIntegrationNotion | undefined;
  enabled: boolean;
  environment: TEnvironment;
  webAppUrl: string;
  surveys: TSurvey[];
  databasesArray: TIntegrationNotionDatabase[];
  locale: TUserLocale;
}

export const PlainWrapper = ({
  notionIntegration,
  enabled,
  environment,
  webAppUrl,
  surveys,
  databasesArray,
  locale,
}: NotionWrapperProps) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(
    notionIntegration ? notionIntegration.config.key?.bot_id : false
  );
  const [selectedIntegration, setSelectedIntegration] = useState<
    (TIntegrationNotionConfigData & { index: number }) | null
  >(null);

  const handleNotionAuthorization = async () => {
    authorize(environment.id, webAppUrl).then((url: string) => {
      if (url) {
        window.location.replace(url);
      }
    });
  };

  const handlePlainAuthorization = async () => {
    setOpen(true);
  };

  return (
    <>
      <AddKeyModal environmentId={environment.id} actionClasses={[]} isReadOnly={false} />
      {isConnected && notionIntegration ? (
        <>
          <AddIntegrationModal
            environmentId={environment.id}
            surveys={surveys}
            open={isModalOpen}
            setOpen={setModalOpen}
            notionIntegration={notionIntegration}
            databases={databasesArray}
            selectedIntegration={selectedIntegration}
          />
          <ManageIntegration
            environment={environment}
            notionIntegration={notionIntegration}
            setOpenAddIntegrationModal={setModalOpen}
            setIsConnected={setIsConnected}
            setSelectedIntegration={setSelectedIntegration}
            locale={locale}
            handleNotionAuthorization={handleNotionAuthorization}
          />
        </>
      ) : (
        <ConnectIntegration
          isEnabled={enabled}
          integrationType={"plain"}
          handleAuthorization={handlePlainAuthorization}
          integrationLogoSrc={PlainLogo}
        />
      )}
    </>
  );
};
