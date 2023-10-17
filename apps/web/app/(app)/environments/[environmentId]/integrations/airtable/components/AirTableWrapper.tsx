"use client";
import { TAirTableIntegration, TAirtable } from "@/../../packages/types/v1/integrations";
import Connect from "./Connect";
import Home from "../Home";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TEnvironment } from "@formbricks/types/v1/environment";

interface AirTableWrapperProps {
  environmentId: string;
  airTableArray: TAirtable[];
  airtableIntegration: TAirTableIntegration | undefined;
  surveys: TSurvey[];
  environment: TEnvironment;
  enabled: boolean;
  webAppUrl: string;
}

export default function AirTableWrapper({
  environmentId,
  airTableArray,
  airtableIntegration,
  surveys,
  environment,
  enabled,
  webAppUrl,
}: AirTableWrapperProps) {
  const [isConnected, setIsConnected_] = useState(
    airtableIntegration ? airtableIntegration.config?.key : false
  );

  const setIsConnected = (data: boolean) => {
    setIsConnected_(data);
  };

  return isConnected && airtableIntegration ? (
    <Home
      airTableArray={airTableArray}
      environmentId={environmentId}
      environment={environment}
      airTableIntegration={airtableIntegration}
      setIsConnected={setIsConnected}
      surveys={surveys}
    />
  ) : (
    <Connect enabled={enabled} environmentId={environment.id} webAppUrl={webAppUrl} />
  );
}
