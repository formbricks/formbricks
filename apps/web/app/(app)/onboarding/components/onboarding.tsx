"use client";

import { Connect } from "@/app/(app)/onboarding/components/Connect";
import { InviteTeamMate } from "@/app/(app)/onboarding/components/InviteTeamMate";
import Objective from "@/app/(app)/onboarding/components/Objective";
import { OnboardingLinkSurvey } from "@/app/(app)/onboarding/components/OnboardingLinkSurvey";
import Role from "@/app/(app)/onboarding/components/Role";
import { Session } from "next-auth";
import { useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TTeam } from "@formbricks/types/teams";
import { TUser } from "@formbricks/types/user";

import { OnboardingHeader } from "./OnboardingHeader";
import PathwaySelect from "./PathwaySelect";

interface OnboardingProps {
  isFormbricksCloud: boolean;
  session: Session;
  environment: TEnvironment;
  user: TUser;
  team: TTeam;
  webAppUrl: string;
}

export function Onboarding({
  isFormbricksCloud,
  session,
  environment,
  user,
  team,
  webAppUrl,
}: OnboardingProps) {
  const [selectedPathway, setSelectedPathway] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(16);
  const [formbricksResponseId, setFormbricksResponseId] = useState<string | undefined>();
  const [CURRENT_STEP, SET_CURRENT_STEP] = useState<number | null>(null);
  const [hideOnboardingHeader, setHideOnboardingHeader] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Access localStorage only when window is available
      const pathwayValueFromLocalStorage = localStorage.getItem("pathway");
      const currentStepValueFromLocalStorage = parseInt(localStorage.getItem("CURRENT_STEP") ?? "1");

      setSelectedPathway(pathwayValueFromLocalStorage);
      SET_CURRENT_STEP(currentStepValueFromLocalStorage);
    }
  }, []);

  useEffect(() => {
    if (CURRENT_STEP) {
      const stepProgressMap = { 1: 16, 2: 50, 3: 65, 4: 75, 5: 90 };
      const newProgress = stepProgressMap[CURRENT_STEP] || 16;
      setProgress(newProgress);
      localStorage.setItem("CURRENT_STEP", CURRENT_STEP.toString());
    }
  }, [CURRENT_STEP]);

  // Function to render current onboarding step
  const renderOnboardingStep = () => {
    switch (CURRENT_STEP) {
      case 1:
        return (
          <PathwaySelect
            setSelectedPathway={setSelectedPathway}
            SET_CURRENT_STEP={SET_CURRENT_STEP}
            isFormbricksCloud={isFormbricksCloud}
          />
        );
      case 2:
        return selectedPathway === "link" ? (
          <OnboardingLinkSurvey
            environmentId={environment.id}
            setHideOnboardingHeader={setHideOnboardingHeader}
            isFormbricksCloud={isFormbricksCloud}
          />
        ) : (
          <Role
            setFormbricksResponseId={setFormbricksResponseId}
            session={session}
            SET_CURRENT_STEP={SET_CURRENT_STEP}
          />
        );
      case 3:
        return (
          <Objective
            formbricksResponseId={formbricksResponseId}
            user={user}
            SET_CURRENT_STEP={SET_CURRENT_STEP}
          />
        );
      case 4:
        return (
          <Connect
            environment={environment}
            webAppUrl={webAppUrl}
            SET_CURRENT_STEP={SET_CURRENT_STEP}
            isFormbricksCloud={isFormbricksCloud}
          />
        );
      case 5:
        return (
          <InviteTeamMate environmentId={environment.id} team={team} SET_CURRENT_STEP={SET_CURRENT_STEP} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-yellow-20 flex h-full w-full flex-col items-center">
      {!hideOnboardingHeader && <OnboardingHeader progress={progress} />}
      <div className="flex h-full w-full items-center justify-center  bg-slate-50">
        {renderOnboardingStep()}
      </div>
    </div>
  );
}
