"use client";

import { ConnectWithFormbricks } from "@/app/(app)/onboarding/components/inapp/ConnectWithFormbricks";
import { InviteTeamMate } from "@/app/(app)/onboarding/components/inapp/InviteTeamMate";
import Objective from "@/app/(app)/onboarding/components/inapp/SurveyObjective";
import Role from "@/app/(app)/onboarding/components/inapp/SurveyRole";
import { CreateFirstSurvey } from "@/app/(app)/onboarding/components/link/CreateFirstSurvey";
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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeVisible, setIframeVisible] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (CURRENT_STEP === 2 && selectedPathway === "link") {
      setIframeVisible(true);
    } else {
      setIframeVisible(false);
    }
  }, [CURRENT_STEP, iframeLoaded, selectedPathway]);

  useEffect(() => {
    // Only execute this logic if the iframe is intended to be visible
    if (iframeVisible) {
      setFade(true); // Start with fading in the iframe

      const handleSurveyCompletion = () => {
        // Logic to run when the survey is completed
        setFade(false); // Start fade-out effect

        setTimeout(() => {
          setIframeVisible(false); // Hide the iframe after fade-out effect is complete
          SET_CURRENT_STEP(5); // Assuming you want to move to the next step after survey completion
        }, 1000); // Adjust timeout duration based on your fade-out CSS transition
      };

      // Setup the event listener for the custom event to listen to survey completion
      window.addEventListener("SurveyCompleted", handleSurveyCompletion);

      // Cleanup function to remove the event listener
      return () => {
        window.removeEventListener("SurveyCompleted", handleSurveyCompletion);
      };
    }
  }, [iframeVisible, CURRENT_STEP]); // Depend on iframeVisible and CURRENT_STEP to re-evaluate when needed

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
        return (
          selectedPathway !== "link" && (
            <Role
              setFormbricksResponseId={setFormbricksResponseId}
              session={session}
              SET_CURRENT_STEP={SET_CURRENT_STEP}
            />
          )
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
          <CreateFirstSurvey environmentId={environment.id} />
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
      <div className="group mt-20 flex w-full justify-center bg-slate-50">
        {renderOnboardingStep()}
        {iframeVisible && (
          <iframe
            src="http://localhost:3000/s/clsui9a7x0000fbh5orp0g7c5"
            onLoad={() => setIframeLoaded(true)}
            style={{
              inset: "0",
              position: "absolute",
              width: "100%",
              height: "100%",
              border: "0",
              zIndex: "40",
              transition: "opacity 1s ease",
              opacity: fade ? "1" : "0", // 1 for fade in, 0 for fade out
            }}></iframe>
        )}
      </div>
    </div>
  );
}
