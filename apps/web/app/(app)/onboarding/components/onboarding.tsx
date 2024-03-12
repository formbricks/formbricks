"use client";

import jsPackageJson from "@/../../packages/js/package.json";
import { finishOnboardingAction } from "@/app/(app)/onboarding/actions";
import { ConnectWithFormbricks } from "@/app/(app)/onboarding/components/inapp/ConnectWithFormbricks";
import { InviteTeamMate } from "@/app/(app)/onboarding/components/inapp/InviteTeamMate";
import { Objective } from "@/app/(app)/onboarding/components/inapp/SurveyObjective";
import { Role } from "@/app/(app)/onboarding/components/inapp/SurveyRole";
import { CreateFirstSurvey } from "@/app/(app)/onboarding/components/link/CreateFirstSurvey";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [selectedPathway, setSelectedPathway] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(16);
  const [formbricksResponseId, setFormbricksResponseId] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeVisible, setIframeVisible] = useState(false);
  const [fade, setFade] = useState(false);

  const handleSurveyCompletion = () => {
    setFade(false);

    setTimeout(() => {
      setIframeVisible(false); // Hide the iframe after fade-out effect is complete
      setCurrentStep(5); // Assuming you want to move to the next step after survey completion
    }, 1000); // Adjust timeout duration based on your fade-out CSS transition
  };

  const handleMessageEvent = (event: MessageEvent) => {
    if (event.origin !== webAppUrl) return;

    if (event.data === "formbricksSurveyCompleted") {
      handleSurveyCompletion();
    }
  };

  useEffect(() => {
    if (currentStep === 2 && selectedPathway === "link") {
      setIframeVisible(true);
    } else {
      setIframeVisible(false);
    }
  }, [currentStep, iframeLoaded, selectedPathway]);

  useEffect(() => {
    if (iframeVisible) {
      setFade(true);
      window.addEventListener("message", handleMessageEvent, false);
      // Cleanup function to remove the event listener
      return () => {
        window.removeEventListener("message", handleMessageEvent, false);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeVisible, currentStep]); // Depend on iframeVisible and currentStep to re-evaluate when needed

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Access localStorage only when window is available
      const pathwayValueFromLocalStorage = localStorage.getItem("onboardingPathway");
      const currentStepValueFromLocalStorage = parseInt(localStorage.getItem("onboardingCurrentStep") ?? "1");

      setSelectedPathway(pathwayValueFromLocalStorage);
      setCurrentStep(currentStepValueFromLocalStorage);
    }
  }, []);

  useEffect(() => {
    if (currentStep) {
      const stepProgressMap = { 1: 16, 2: 50, 3: 65, 4: 75, 5: 90 };
      const newProgress = stepProgressMap[currentStep] || 16;
      setProgress(newProgress);
      localStorage.setItem("onboardingCurrentStep", currentStep.toString());
    }
  }, [currentStep]);

  // Function to render current onboarding step
  const renderOnboardingStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PathwaySelect
            setSelectedPathway={setSelectedPathway}
            setCurrentStep={setCurrentStep}
            isFormbricksCloud={isFormbricksCloud}
          />
        );
      case 2:
        return (
          selectedPathway !== "link" && (
            <Role
              setFormbricksResponseId={setFormbricksResponseId}
              session={session}
              setCurrentStep={setCurrentStep}
            />
          )
        );
      case 3:
        return (
          <Objective
            formbricksResponseId={formbricksResponseId}
            user={user}
            setCurrentStep={setCurrentStep}
          />
        );
      case 4:
        return (
          <ConnectWithFormbricks
            environment={environment}
            webAppUrl={webAppUrl}
            jsPackageVersion={jsPackageJson.version}
            setCurrentStep={setCurrentStep}
          />
        );
      case 5:
        return selectedPathway === "link" ? (
          <CreateFirstSurvey environmentId={environment.id} />
        ) : (
          <InviteTeamMate environmentId={environment.id} team={team} setCurrentStep={setCurrentStep} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="group flex h-full w-full flex-col items-center bg-slate-50">
      <div className="hidden">
        <button
          id="FB__INTERNAL__SKIP_ONBOARDING"
          onClick={async () => {
            await finishOnboardingAction();
            router.push(`/environments/${environment.id}/surveys`);
          }}>
          Skip onboarding
        </button>
      </div>

      <OnboardingHeader progress={progress} />
      <div className="mt-20 flex w-full justify-center bg-slate-50">
        {renderOnboardingStep()}
        {iframeVisible && isFormbricksCloud && (
          <iframe
            src={`https://app.formbricks.com/s/clr737oiseav88up09skt2hxo?userId=${session.user.id}`}
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
