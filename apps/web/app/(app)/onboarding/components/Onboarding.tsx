"use client";

import { Logo } from "@/components/Logo";
import { ProgressBar } from "@formbricks/ui";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import Greeting from "./Greeting";
import Objective from "./Objective";
import Product from "./Product";
import Role from "./Role";
import { TProfile } from "@formbricks/types/v1/profile";
import { TProduct } from "@formbricks/types/v1/product";
import { updateProfileAction } from "@/app/(app)/onboarding/actions";

const MAX_STEPS = 6;

interface OnboardingProps {
  session: Session | null;
  environmentId: string;
  profile: TProfile;
  product: TProduct;
}

export default function Onboarding({ session, environmentId, profile, product }: OnboardingProps) {
  const [formbricksResponseId, setFormbricksResponseId] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const percent = useMemo(() => {
    return currentStep / MAX_STEPS;
  }, [currentStep]);

  const skipStep = () => {
    setCurrentStep(currentStep + 1);
  };

  const doLater = async () => {
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
      await updateProfileAction(updatedProfile);

      if (environmentId) {
        router.push(`/environments/${environmentId}/surveys`);
        return;
      }
    } catch (e) {
      toast.error("An error occured saving your settings.");
      setIsLoading(false);
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
        {currentStep === 1 && (
          <Greeting next={next} skip={doLater} name={profile.name ? profile.name : ""} session={session} />
        )}
        {currentStep === 2 && (
          <Role
            next={next}
            skip={skipStep}
            setFormbricksResponseId={setFormbricksResponseId}
            profile={profile}
          />
        )}
        {currentStep === 3 && (
          <Objective
            next={next}
            skip={skipStep}
            formbricksResponseId={formbricksResponseId}
            profile={profile}
          />
        )}
        {currentStep === 4 && (
          <Product done={done} environmentId={environmentId} isLoading={isLoading} product={product} />
        )}
      </div>
    </div>
  );
}
