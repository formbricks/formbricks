"use client";

import { updateUserAction } from "@/app/(app)/onboarding/actions";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { TProduct } from "@formbricks/types/product";
import { TUser } from "@formbricks/types/user";
import { Logo } from "@formbricks/ui/Logo";
import { ProgressBar } from "@formbricks/ui/ProgressBar";

import Greeting from "./Greeting";
import Objective from "./Objective";
import Product from "./Product";
import Role from "./Role";

const MAX_STEPS = 6;

interface OnboardingProps {
  session: Session;
  environmentId: string;
  user: TUser;
  product: TProduct;
}

export default function Onboarding({ session, environmentId, user, product }: OnboardingProps) {
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
      const updatedProfile = {
        ...user,
        onboardingCompleted: true,
        notificationSettings: {
          alert: user.notificationSettings?.alert || {},
          weeklySummary: user.notificationSettings?.weeklySummary || {},
          doNotSubscribeToTeams: user.notificationSettings?.doNotSubscribeToTeams || [],
        },
      };
      await updateUserAction(updatedProfile);

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
            <ProgressBar progress={percent} barColor="bg-brand-dark" height={2} />
          </div>
          <div className="grow-0 text-xs font-semibold text-slate-700">
            {currentStep < 5 ? <>{Math.floor(percent * 100)}% complete</> : <>Almost there!</>}
          </div>
        </div>
        <div className="col-span-2" />
      </div>
      <div className="flex grow items-center justify-center">
        {currentStep === 1 && (
          <Greeting next={next} skip={doLater} name={user.name ? user.name : ""} session={session} />
        )}
        {currentStep === 2 && (
          <Role
            next={next}
            skip={skipStep}
            setFormbricksResponseId={setFormbricksResponseId}
            session={session}
          />
        )}
        {currentStep === 3 && (
          <Objective next={next} skip={skipStep} formbricksResponseId={formbricksResponseId} user={user} />
        )}
        {currentStep === 4 && (
          <Product done={done} environmentId={environmentId} isLoading={isLoading} product={product} />
        )}
      </div>
    </div>
  );
}
