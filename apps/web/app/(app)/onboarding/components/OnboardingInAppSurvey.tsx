"use client";

import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TProduct } from "@formbricks/types/product";
import { TUser } from "@formbricks/types/user";

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

export function OnboardingInAppSurvey({ session, environmentId, user, product }: OnboardingProps) {
  const [formbricksResponseId, setFormbricksResponseId] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const skipStep = () => {
    setCurrentStep(currentStep + 1);
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
      if (environmentId) {
        router.push(`/onboarding/inApp/connect`);
      }
    } catch (e) {
      toast.error("An error occured saving your settings.");
      setIsLoading(false);
      console.error(e);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-6 items-center  pt-8"></div>
      <div className="flex grow items-center justify-center">
        {currentStep === 1 && (
          <Role
            next={next}
            skip={skipStep}
            setFormbricksResponseId={setFormbricksResponseId}
            session={session}
          />
        )}
        {currentStep === 2 && (
          <Objective next={next} skip={skipStep} formbricksResponseId={formbricksResponseId} user={user} />
        )}
        {currentStep === 3 && (
          <Product done={done} environmentId={environmentId} isLoading={isLoading} product={product} />
        )}
      </div>
    </div>
  );
}
