"use client";

import { finishOnboardingAction } from "@/app/(app)/onboarding/actions";
import Dance from "@/images/onboarding-dance.gif";
import Lost from "@/images/onboarding-lost.gif";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Button } from "@formbricks/ui/Button";
import { OnboardingSetupInstructions } from "./OnboardingSetupInstructions";

interface ConnectWithFormbricksProps {
  environmentId: string;
  webAppUrl: string;
  jsPackageVersion: string;
  widgetSetupCompleted: boolean;
  channel: string;
  industry: string;
}

export const ConnectWithFormbricks = ({
  environmentId,
  webAppUrl,
  jsPackageVersion,
  widgetSetupCompleted,
  channel,
  industry,
}: ConnectWithFormbricksProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const handleFinishOnboarding = async () => {
    if (!widgetSetupCompleted) {
      router.push(`/onboarding/${environmentId}/connect/invite?channel=${channel}&industry=${industry}`);
      return;
    }

    try {
      setIsLoading(true);
      await finishOnboardingAction();
      router.push(`/environments/${environmentId}/surveys?channel=${channel}&industry=${industry}`);
    } catch (error) {
      setIsLoading(false);
    }
  };
  return (
    <div className="mt-6 flex w-5/6 flex-col items-center space-y-10 xl:w-2/3">
      <div className="flex w-full space-x-10">
        <div className="flex w-1/2 flex-col space-y-4">
          <OnboardingSetupInstructions
            environmentId={environmentId}
            webAppUrl={webAppUrl}
            jsPackageVersion={jsPackageVersion}
          />
        </div>
        <div className="flex h-[30rem] w-1/2 flex-col items-center justify-center rounded-lg border bg-slate-200 text-center shadow">
          {widgetSetupCompleted ? (
            <div>
              <Image src={Dance} alt="lost" height={250} />
              <p className="mt-6 text-xl font-bold">Connection successful ✅</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Image src={Lost} alt="lost" height={250} />
              <p className="mt-6 text-xl font-bold">Waiting for your signal...</p>
            </div>
          )}
        </div>
      </div>
      <Button
        id="finishOnboarding"
        variant={widgetSetupCompleted ? "darkCTA" : "secondary"}
        onClick={handleFinishOnboarding}
        loading={isLoading}>
        {widgetSetupCompleted ? "Finish Onboarding" : "Skip"}
      </Button>
    </div>
  );
};
