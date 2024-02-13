"use client";

import { redirect } from "next/navigation";
import { useState } from "react";

import { Logo } from "../Logo";
import { ProgressBar } from "../ProgressBar";
import OnboardingInAppSurvey from "./components/OnboardingInAppSurvey";
import OnboardingLinkSurvey from "./components/OnboardingLinkSurvey";
import PathwaySelect from "./components/PathwaySelect";

export function Onboarding({ environmentId }: { environmentId: string }) {
  const [progress, setprogress] = useState(16);
  const [selectedPathway, setselectedPathway] = useState<"link" | "in-app" | null>(null);
  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-6 items-center  pt-8">
        <div className="col-span-2">
          <Logo className="ml-4 w-1/2" />
        </div>
        <div className="col-span-1" />
        <div className="col-span-3 flex items-center justify-center gap-8">
          <div className="relative grow overflow-hidden rounded-full bg-slate-200">
            <ProgressBar progress={progress / 100} barColor="bg-brand-dark" height={2} />
          </div>
          <span className="font-medium">{progress}% complete</span>
        </div>
      </div>
      <div className="flex h-full items-center justify-center">
        {progress === 16 && selectedPathway === null && (
          <PathwaySelect setselectedPathway={setselectedPathway} setprogress={setprogress} />
        )}
        {progress === 50 && selectedPathway === "link" && redirect("/onboarding/linkSurveyOnboarding")}
        {progress === 50 && selectedPathway === "in-app" && <OnboardingInAppSurvey />}
      </div>
    </div>
  );
}
