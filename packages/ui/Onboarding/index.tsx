"use client";

import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { updateUserAction } from "./actions";
import OnboardingHeader from "./components/OnboardingHeader";
import PathwaySelect from "./components/PathwaySelect";

export function Onboarding({ isFormbricksCloud }: { isFormbricksCloud: boolean }) {
  const [selectedPathway, setselectedPathway] = useState<"link" | "in-app" | null>(null);

  const finishOnboarding = async () => {
    try {
      const updatedProfile = { onboardingCompleted: true };
      await updateUserAction(updatedProfile);
    } catch (e) {
      toast.error("An error occured saving your settings.");
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedPathway === "link") {
      if (isFormbricksCloud) {
        redirect("/onboarding/link/survey");
      } else {
        finishOnboarding();
        redirect("/");
      }
    } else if (selectedPathway === "in-app") {
      if (isFormbricksCloud) {
        redirect("/onboarding/inApp/survey");
      } else {
        redirect("/onboarding/inApp/connect");
      }
    }
  }, [selectedPathway]);

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <OnboardingHeader progress={16} />
      <div className="flex h-full items-center justify-center">
        {selectedPathway === null && <PathwaySelect setselectedPathway={setselectedPathway} />}
      </div>
    </div>
  );
}
