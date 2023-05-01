"use client";

import { cn } from "@/../../packages/lib/cn";
import { Logo } from "@/components/Logo";
import { useProfile } from "@/lib/profile";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { fetcher } from "@formbricks/lib/fetcher";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import Greeting from "./greeting";
import Intention from "./intention";
import Objective from "./objective";
import Product from "./product";
import Role from "./role";

const MAX_STEPS = 6;

export default function Onboarding() {
  const { data, error } = useSWR(`/api/v1/environments/find-first`, fetcher);
  const { profile } = useProfile();
  const { triggerProfileMutate } = useProfileMutation();
  const [currentStep, setCurrentStep] = useState(1);
  const router = useRouter();

  const percent = useMemo(() => {
    return Math.floor((currentStep / MAX_STEPS) * 100);
  }, [currentStep]);

  const progressSize = useMemo(() => {
    switch (percent) {
      case 16:
        return "w-1/6";
      case 33:
        return "w-2/6";
      case 50:
        return "w-3/6";
      case 66:
        return "w-4/6";
      case 83:
        return "w-5/6";
    }
  }, [percent]);

  if (!profile) {
    return <div className="flex h-full w-full items-center justify-center">Loading</div>;
  }

  if (error) {
    return <div className="flex h-full w-full items-center justify-center">An error occurred</div>;
  }

  const skip = () => {
    setCurrentStep(5);
  };

  const next = () => {
    if (currentStep < MAX_STEPS) {
      setCurrentStep((value) => value + 1);
      return;
    }
  };

  const done = async () => {
    try {
      const updatedProfile = { ...profile, onboardingDisplayed: true };
      await triggerProfileMutate(updatedProfile);
      if (data) {
        router.push(`/environments/${data.id}`);
      }
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-6 items-center pb-4 pt-12">
        <div className="col-span-2">
          <Logo className="w-1/2" />
        </div>
        <div className="col-span-2 flex items-center justify-center gap-8">
          <div className="relative h-2 grow overflow-hidden rounded-full bg-slate-200">
            <div className={cn(progressSize, "bg-brand-light absolute h-full transition-all")} />
          </div>
          <div className="grow-0 text-xs font-semibold text-slate-700">
            {currentStep < 5 ? <>{percent}% complete</> : <>Almost there!</>}
          </div>
        </div>
        <div className="col-span-2" />
      </div>
      <div className="flex grow items-center justify-center">
        {currentStep === 1 && <Greeting next={next} skip={skip} name={profile.name} />}
        {currentStep === 2 && <Intention next={next} skip={skip} />}
        {currentStep === 3 && <Role next={next} skip={skip} />}
        {currentStep === 4 && <Objective next={next} skip={skip} />}
        {currentStep === 5 && <Product done={done} environmentId={data.id} />}
      </div>
      <div className="flex items-center justify-center text-xs text-slate-500">
        <div className="pb-12 pt-8 text-center">
          <p>Your answers will help us improve your experience and help others like you.</p>
          <p>
            <Link href="" className="underline">
              Click here
            </Link>{" "}
            to learn how we handle your data.
          </p>
        </div>
      </div>
    </div>
  );
}
