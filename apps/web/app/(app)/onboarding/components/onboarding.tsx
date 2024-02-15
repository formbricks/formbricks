"use client";

import { finishOnboardingAction } from "@/app/(app)/onboarding/actions";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OnboardingHeader } from "./OnboardingHeader";
import PathwaySelect from "./PathwaySelect";

export function Onboarding({ isFormbricksCloud }: { isFormbricksCloud: boolean }) {
  const [selectedPathway, setSelectedPathway] = useState<"link" | "in-app" | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleRedirection = async () => {
      if (selectedPathway === "link") {
        if (isFormbricksCloud) {
          router.push("/onboarding/link/survey");
        } else {
          await finishOnboardingAction();
          router.push("/");
        }
      } else if (selectedPathway === "in-app") {
        const path = isFormbricksCloud ? "/onboarding/inApp/survey" : "/onboarding/inApp/connect";
        router.push(path);
      }
    };

    if (selectedPathway) {
      handleRedirection();
    }
  }, [selectedPathway, isFormbricksCloud]);

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <OnboardingHeader progress={16} />

      <div className="flex h-full items-center justify-center">
        {selectedPathway === null && <PathwaySelect setSelectedPathway={setSelectedPathway} />}
      </div>
    </div>
  );
}
