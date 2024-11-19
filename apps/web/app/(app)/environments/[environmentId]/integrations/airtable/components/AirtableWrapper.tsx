"use client";

import { ManageIntegration } from "@/app/(app)/environments/[environmentId]/integrations/airtable/components/ManageIntegration";
import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable";
import airtableLogo from "@/images/airtableLogo.svg";
import { useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ConnectIntegration } from "@formbricks/ui/components/ConnectIntegration";

interface AirtableWrapperProps {
  environmentId: string;
  airtableArray: TIntegrationItem[];
  airtableIntegration?: TIntegrationAirtable;
  surveys: TSurvey[];
  environment: TEnvironment;
  isEnabled: boolean;
  webAppUrl: string;
  contactAttributeKeys: TContactAttributeKey[];
  locale: TUserLocale;
}

export const AirtableWrapper = ({
  environmentId,
  airtableArray,
  airtableIntegration,
  surveys,
  environment,
  isEnabled,
  webAppUrl,
  contactAttributeKeys,
  locale,
}: AirtableWrapperProps) => {
  const [isConnected, setIsConnected] = useState(
    airtableIntegration ? airtableIntegration.config?.key : false
  );

  const handleAirtableAuthorization = async () => {
    authorize(environmentId, webAppUrl).then((url: string) => {
      if (url) {
        window.location.replace(url);
      }
    });
  };

  return isConnected && airtableIntegration ? (
    <ManageIntegration
      airtableArray={airtableArray}
      environmentId={environmentId}
      environment={environment}
      airtableIntegration={airtableIntegration}
      setIsConnected={setIsConnected}
      surveys={surveys}
      contactAttributeKeys={contactAttributeKeys}
      locale={locale}
    />
  ) : (
    <ConnectIntegration
      isEnabled={isEnabled}
      integrationType={"airtable"}
      handleAuthorization={handleAirtableAuthorization}
      integrationLogoSrc={airtableLogo}
    />
  );
};
