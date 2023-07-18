"use client";

import { Logo } from "@/components/Logo";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProfile } from "@/lib/profile";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { fetcher } from "@formbricks/lib/fetcher";
import { ProgressBar } from "@formbricks/ui";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import useSWR from "swr";
import Greeting from "./Greeting";
import Objective from "./Objective";
import Product from "./Product";
import Role from "./Role";
import { ResponseId } from "@formbricks/js";

const MAX_STEPS = 6;

interface OnboardingProps {
  session: Session | null;
}

export default function Onboarding({ session }: OnboardingProps) {
  const {
    data: environment,
    error: isErrorEnvironment,
    isLoading: isLoadingEnvironment,
  } = useSWR(`/api/v1/environments/find-first`, fetcher);
  const { profile } = useProfile();
  const { triggerProfileMutate } = useProfileMutation();
  const [formbricksResponseId, setFormbricksResponseId] = useState<ResponseId | undefined>();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const percent = useMemo(() => {
    return currentStep / MAX_STEPS;
  }, [currentStep]);

  if (!profile || isLoadingEnvironment) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorEnvironment) {
    return <div className="flex h-full w-full items-center justify-center">An error occurred</div>;
  }

  const skipStep = () => {
    setCurrentStep(currentStep + 1);
  };

  const doLater = () => {
    setCurrentStep(4);
  };

  const next = () => {
    if (currentStep < MAX_STEPS) {
      setCurrentStep((value) => value + 1);
      return;
    }
  };

  const done = async () => {
    setIsLoading(true);
    try {
      const updatedProfile = { ...profile, onboardingCompleted: true };
      await triggerProfileMutate(updatedProfile);
      if (environment) {
        router.push(`/environments/${environment.id}/surveys`);
        return;
      }
    } catch (e) {
      toast.error("An error occured saving your settings.");
      console.error(e);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-6 items-center  pt-8">
        <div className="col-span-2">
          <Logo className="ml-4 w-1/2" />
        </div>
        <div className="col-span-2 flex items-center justify-center gap-8">
          <div className="relative grow overflow-hidden rounded-full bg-slate-200">
            <ProgressBar progress={percent} barColor="bg-brand" height={2} />
          </div>
          <div className="grow-0 text-xs font-semibold text-slate-700">
            {currentStep < 5 ? <>{Math.floor(percent * 100)}% complete</> : <>Almost there!</>}
          </div>
        </div>
        <div className="col-span-2" />
      </div>
      <div className="flex grow items-center justify-center">
        {currentStep === 1 && <Greeting next={next} skip={doLater} name={profile.name} session={session} />}
        {currentStep === 2 && (
          <Role next={next} skip={skipStep} setFormbricksResponseId={setFormbricksResponseId} />
        )}
        {currentStep === 3 && (
          <Objective next={next} skip={skipStep} formbricksResponseId={formbricksResponseId} />
        )}
        {currentStep === 4 && <Product done={done} environmentId={environment.id} isLoading={isLoading} />}
      </div>
    </div>
  );
}
