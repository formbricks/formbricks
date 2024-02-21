"use client";

import { ConnectWithFormbricks } from "@/app/(app)/onboarding/components/inapp/ConnectWithFormbricks";
import { InviteTeamMate } from "@/app/(app)/onboarding/components/inapp/InviteTeamMate";
import Objective from "@/app/(app)/onboarding/components/inapp/SurveyObjective";
import Role from "@/app/(app)/onboarding/components/inapp/SurveyRole";
import { SurveyiFrameHandling } from "@/app/(app)/onboarding/components/link/SurveyiFrameHandling";
import { Session } from "next-auth";
import { useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TTeam } from "@formbricks/types/teams";
import { TUser } from "@formbricks/types/user";

import PathwaySelect from "./PathwaySelect";
import { OnboardingHeader } from "./ProgressBar";

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
          <SurveyiFrameHandling
            environmentId={environment.id}
            isFormbricksCloud={isFormbricksCloud}
            SET_CURRENT_STEP={SET_CURRENT_STEP}
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
          <ConnectWithFormbricks
            environment={environment}
            webAppUrl={webAppUrl}
            SET_CURRENT_STEP={SET_CURRENT_STEP}
            isFormbricksCloud={isFormbricksCloud}
          />
        );
      case 5:
        return selectedPathway === "link" ? (
          <SurveyiFrameHandling
            environmentId={environment.id}
            isFormbricksCloud={isFormbricksCloud}
            SET_CURRENT_STEP={SET_CURRENT_STEP}
          />
        ) : (
          <InviteTeamMate environmentId={environment.id} team={team} SET_CURRENT_STEP={SET_CURRENT_STEP} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center bg-slate-50">
      <OnboardingHeader progress={progress} />
      <div className="group mt-20 flex w-full justify-center bg-slate-50">{renderOnboardingStep()}</div>
    </div>
  );
}
