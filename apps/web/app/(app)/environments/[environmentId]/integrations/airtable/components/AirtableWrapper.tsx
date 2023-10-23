"use client";
import Connect from "./Connect";
import Home from "../Home";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { TIntegrationItem } from "@formbricks/types/integration";

interface AirtableWrapperProps {
  environmentId: string;
  airtableArray: TIntegrationItem[];
  airtableIntegration?: TIntegrationAirtable;
  surveys: TSurvey[];
  environment: TEnvironment;
  enabled: boolean;
  webAppUrl: string;
}

export default function AirtableWrapper({
  environmentId,
  airtableArray,
  airtableIntegration,
  surveys,
  environment,
  enabled,
  webAppUrl,
}: AirtableWrapperProps) {
  const [isConnected, setIsConnected_] = useState(
    airtableIntegration ? airtableIntegration.config?.key : false
  );

  const setIsConnected = (data: boolean) => {
    setIsConnected_(data);
  };

  return isConnected && airtableIntegration ? (
    <Home
      airtableArray={airtableArray}
      environmentId={environmentId}
      environment={environment}
      airtableIntegration={airtableIntegration}
      setIsConnected={setIsConnected}
      surveys={surveys}
    />
  ) : (
    <Connect enabled={enabled} environmentId={environment.id} webAppUrl={webAppUrl} />
  );
}
