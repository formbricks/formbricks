"use client";

import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";
import Dance from "@/images/onboarding-dance.gif";
import Lost from "@/images/onboarding-lost.gif";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { Button } from "@formbricks/ui/Button";

import { fetchEnvironment, finishOnboardingAction } from "../../actions";
import { SetupInstructionsOnboarding } from "./SetupInstructions";

const goToProduct = async (router) => {
  if (typeof localStorage !== undefined) {
    localStorage.removeItem("onboardingPathway");
    localStorage.removeItem("onboardingCurrentStep");
  }
  await finishOnboardingAction();
  router.push("/");
};

const goToTeamInvitePage = async () => {
  localStorage.setItem("onboardingCurrentStep", "5");
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
  const posthog = usePostHog();
  posthog.capture("onboarding-sdk-connected");
  return (
    <div className="flex w-full max-w-xl flex-col gap-8">
      <OnboardingTitle title="We are connected!" subtitle="From now on it's a piece of cake 🍰" />

      <div className="w-full space-y-8 rounded-lg border border-emerald-300 bg-emerald-50 p-8 text-center">
        <Image src={Dance} alt="Dance" className="rounded-lg" />

        <p className="text-lg font-semibold text-emerald-900">Connection successful ✅</p>
      </div>
      <div className="mt-4 text-right">
        <Button
          id="onboarding-inapp-connect-connection-successful"
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

const NotConnectedState = ({ environment, webAppUrl, jsPackageVersion, goToTeamInvitePage }) => {
  return (
    <div className="mb-8 w-full max-w-xl space-y-8">
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
        jsPackageVersion={jsPackageVersion}
      />
      <div className="flex justify-center">
        <Button
          id="onboarding-inapp-connect-not-sure-how-to-do-this"
          className="mt-8 font-normal text-slate-400"
          variant="minimal"
          onClick={goToTeamInvitePage}>
          Skip
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface ConnectProps {
  environment: TEnvironment;
  webAppUrl: string;
  jsPackageVersion: string;
  setCurrentStep: (currentStep: number) => void;
}

export const ConnectWithFormbricks = ({
  environment,
  webAppUrl,
  jsPackageVersion,
  setCurrentStep,
}: ConnectProps) => {
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
  }, [environment.id]);

  return localEnvironment.widgetSetupCompleted ? (
    <ConnectedState
      goToProduct={() => {
        goToProduct(router);
      }}
    />
  ) : (
    <NotConnectedState
      jsPackageVersion={jsPackageVersion}
      webAppUrl={webAppUrl}
      environment={environment}
      goToTeamInvitePage={() => {
        setCurrentStep(5);
        localStorage.setItem("onboardingCurrentStep", "5");
        goToTeamInvitePage();
      }}
    />
  );
};
