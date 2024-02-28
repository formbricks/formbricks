"use client";

import OnboardingTitle from "@/app/(app)/onboarding/components/OnboardingTitle";
import Dance from "@/images/onboarding-dance.gif";
import Lost from "@/images/onboarding-lost.gif";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { Button } from "@formbricks/ui/Button";

import { fetchEnvironment, finishOnboardingAction } from "../../actions";
import SetupInstructionsOnboarding from "./SetupInstructions";

const goToProduct = async (router) => {
  await finishOnboardingAction();
  router.push("/");
};

const goToTeamInvitePage = async () => {
  localStorage.setItem("currentStep", "5");
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
    <div className="flex w-full max-w-xl flex-col gap-8">
      <OnboardingTitle title="We are connected!" subtitle="From now on it's a piece of cake 🍰" />

      <div className="w-full space-y-8 rounded-lg border border-emerald-300 bg-emerald-50 p-8 text-center">
        <Image src={Dance} alt="Dance" className="rounded-lg" />

        <p className="text-lg font-semibold text-emerald-900">Connection successful ✅</p>
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
    <div className="group mb-8 w-full max-w-xl space-y-8">
      <OnboardingTitle
        title="Connect your app or website"
        subtitle="It takes just a few minutes to set it up."
      />

      <div className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-12 py-3 text-slate-700">
        Waiting for your signal...
        <Image src={Lost} alt="lost" height={75} />
      </div>
      <div className="w-full border-b border-slate-200 " />
      <SetupInstructionsOnboarding
        environmentId={environment.id}
        webAppUrl={webAppUrl}
        isFormbricksCloud={isFormbricksCloud}
      />
      <div className="flex justify-center">
        <Button
          className="opacity-0 transition-all delay-[3000ms] duration-500 ease-in-out group-hover:opacity-100"
          variant="minimal"
          onClick={goToTeamInvitePage}>
          I am not sure how to do this
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface ConnectProps {
  environment: TEnvironment;
  webAppUrl: string;
  isFormbricksCloud: boolean;
  setCurrentStep: (currentStep: number) => void;
}

export function ConnectWithFormbricks({
  environment,
  webAppUrl,
  setCurrentStep,
  isFormbricksCloud,
}: ConnectProps) {
  const router = useRouter();
  const [localEnvironment, setLocalEnvironment] = useState(environment);

  useVisibilityChange(environment, setLocalEnvironment);

  useEffect(() => {
    const fetchLatestEnvironmentOnFirstLoad = async () => {
      const refetchedEnvironment = await fetchEnvironment(environment.id);
      if (!refetchedEnvironment) return;
      setLocalEnvironment(refetchedEnvironment);
    };
    fetchLatestEnvironmentOnFirstLoad();
  }, []);

  return localEnvironment.widgetSetupCompleted ? (
    <ConnectedState
      goToProduct={() => {
        goToProduct(router);
      }}
    />
  ) : (
    <NotConnectedState
      isFormbricksCloud={isFormbricksCloud}
      webAppUrl={webAppUrl}
      environment={environment}
      goToTeamInvitePage={() => {
        setCurrentStep(5);
        localStorage.setItem("currentStep", "5");
        goToTeamInvitePage();
      }}
    />
  );
}
