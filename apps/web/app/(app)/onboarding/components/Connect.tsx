"use client";

import { customSurvey } from "@/app/(app)/environments/[environmentId]/surveys/templates/templates";
import Dance from "@/images/onboarding-dance.gif";
import Lost from "@/images/onboarding-lost.gif";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { Button } from "@formbricks/ui/Button";

import { createSurveyFromTemplate, fetchEnvironment, finishOnboardingAction } from "../actions";
import SetupInstructionsOnboarding from "./SetupInstructionsOnboarding";

const goToProduct = async (router) => {
  await finishOnboardingAction();
  router.push("/");
};

const goToTeamInvitePage = async () => {
  localStorage.setItem("CURRENT_STEP", "5");
};

// Custom hook for visibility change logic
const useVisibilityChange = (environment, setLocalEnvironment) => {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const refetchedEnvironment = await fetchEnvironment(environment.id);
        if (!refetchedEnvironment) return;
        setLocalEnvironment(refetchedEnvironment);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [environment, setLocalEnvironment]);
};

const ConnectedState = ({ goToProduct }) => {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <div className="group flex w-[36rem] flex-col items-center justify-center space-y-10 p-6 text-slate-800">
      <div className="space-y-4 text-center text-slate-800">
        <p className="text-2xl font-medium">You&apos;re connected!</p>
        <p className="text-sm text-slate-700">From now on it&apos;s a piece of cake 🍰</p>
      </div>
      <div className="border-brand w-full space-y-8 rounded-lg border bg-teal-50 p-8 text-center">
        <Image src={Dance} alt="Dance" className="rounded-lg" />

        <p className="text-lg font-semibold">Connection successful ✅</p>
      </div>
      <div className="mt-4 text-right">
        <Button
          variant="minimal"
          loading={isLoading}
          onClick={() => {
            setIsLoading(true);
            goToProduct();
          }}>
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const NotConnectedState = ({ environment, webAppUrl, isFormbricksCloud, goToTeamInvitePage }) => {
  return (
    <div className="group flex w-[36rem] flex-col items-center justify-center space-y-10 p-6 text-slate-800">
      <div className="space-y-4 text-center text-slate-800">
        <p className="text-2xl font-medium">Connect your app or website with Formbricks</p>
        <p className="text-sm text-slate-700">It takes just a few minutes to set it up.</p>
      </div>
      <div className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-12 py-3 text-slate-700">
        Waiting for your signal...
        <Image src={Lost} alt="lost" height={75} />
      </div>
      <div className="w-full border-b border-slate-300 " />
      <SetupInstructionsOnboarding
        environmentId={environment.id}
        webAppUrl={webAppUrl}
        isFormbricksCloud={isFormbricksCloud}
      />

      <Button
        className="opacity-0 transition-all delay-[1500ms] duration-500 ease-in-out group-hover:opacity-100"
        variant="minimal"
        onClick={goToTeamInvitePage}>
        I am not sure how to do this
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

interface ConnectProps {
  environment: TEnvironment;
  webAppUrl: string;
  isFormbricksCloud: boolean;
  SET_CURRENT_STEP: (currentStep: number) => void;
}

export function Connect({ environment, webAppUrl, SET_CURRENT_STEP, isFormbricksCloud }: ConnectProps) {
  const router = useRouter();
  const [localEnvironment, setLocalEnvironment] = useState(environment);

  useVisibilityChange(environment, setLocalEnvironment);

  useEffect(() => {
    if (localEnvironment.widgetSetupCompleted) {
      createSurvey();
    }
  }, [localEnvironment.widgetSetupCompleted]);

  useEffect(() => {
    const fetchLatestEnvironmentOnFirstLoad = async () => {
      const refetchedEnvironment = await fetchEnvironment(environment.id);
      if (!refetchedEnvironment) return;
      setLocalEnvironment(refetchedEnvironment);
    };
    fetchLatestEnvironmentOnFirstLoad();
  }, []);

  const createSurvey = async () => {
    await createSurveyFromTemplate(customSurvey, localEnvironment, "in-app");
  };

  return localEnvironment.widgetSetupCompleted ? (
    <ConnectedState
      goToProduct={() => {
        localStorage.removeItem("CURRENT_STEP");
        localStorage.removeItem("pathway");
        goToProduct(router);
      }}
    />
  ) : (
    <NotConnectedState
      isFormbricksCloud={isFormbricksCloud}
      webAppUrl={webAppUrl}
      environment={environment}
      goToTeamInvitePage={() => {
        SET_CURRENT_STEP(5);
        localStorage.setItem("CURRENT_STEP", "5");
        goToTeamInvitePage();
      }}
    />
  );
}
