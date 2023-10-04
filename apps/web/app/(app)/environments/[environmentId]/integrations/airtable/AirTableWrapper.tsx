"use client";
import { TAirTableIntegration, TAirtable } from "@/../../packages/types/v1/integrations";
import Connect from "./Connect";
import Home from "./Home";
import { useState } from "react";
import AddIntegrationModal from "./AddIntegrationModal";
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
    airtableIntegration ? airtableIntegration.config?.key : false
  );
  const [isModalOpen, setModalOpen] = useState(false);
  const setIsConnected = (data: boolean) => {
    setIsConnected_(data);
  };

  const handleModal = (data: boolean) => {
    setModalOpen(data);
  };
  return isConnected && airtableIntegration ? (
    <>
      <AddIntegrationModal
        airTableArray={airTableArray}
        open={isModalOpen}
        setOpenWithStates={handleModal}
        environmentId={environmentId}
        surveys={surveys}
        airtableIntegration={airtableIntegration}
      />
      <Home
        environmentId={environmentId}
        environment={environment}
        airTableIntegration={airtableIntegration}
        handleModal={handleModal}
      />
    </>
  ) : (
    <Connect environmentId={environmentId} setIsConnected={setIsConnected} />
  );
}
