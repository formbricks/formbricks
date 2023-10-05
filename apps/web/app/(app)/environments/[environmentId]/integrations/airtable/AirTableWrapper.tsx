"use client";
import { TAirTableIntegration, TAirtable } from "@/../../packages/types/v1/integrations";
import Connect from "./Connect";
import Home from "./Home";
import { useState } from "react";
import { TSurvey } from "@/../../packages/types/v1/surveys";
import { TEnvironment } from "@/../../packages/types/v1/environment";

interface AirTableWrapperProps {
  environmentId: string;
  airTableArray: TAirtable[];
  airtableIntegration: TAirTableIntegration | undefined;
  surveys: TSurvey[];
  environment: TEnvironment;
}

export default function AirTableWrapper({
  environmentId,
  airTableArray,
  airtableIntegration,
  surveys,
  environment,
}: AirTableWrapperProps) {
  const [isConnected, setIsConnected_] = useState(
    typeof airtableIntegration?.config.key !== undefined ? true : false
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
    <Connect environmentId={environmentId} setIsConnected={setIsConnected} />
  );
}
