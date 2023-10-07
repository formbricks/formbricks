"use client";

import { XMarkIcon, EyeSlashIcon, PlusIcon } from "@heroicons/react/24/solid";
// import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";

/*
    interface HiddenFieldCardProps {
    localSurvey: TSurveyWithAnalytics;
    setLocalSurvey: (survey: TSurveyWithAnalytics) => void;
    setActiveQuestionId: (id: string | null) => void;
    activeQuestionId: string | null;
  }
 */

export default function HiddenFieldCard() {
  return (
    <div className="mt-2 w-10/12 p-[1rem]">
      <div className="flex w-11/12 justify-between text-slate-400">
        <h3 className="font medium">Hidden fields</h3>
        <XMarkIcon />
      </div>
      <div className="divider mt-2 w-11/12 bg-slate-200"></div>
      <div className="mt-2 flex w-2/6 justify-evenly">
        <div className="flex h-[1.2rem] w-5/12 justify-evenly bg-slate-300">
          <EyeSlashIcon />
          <h6>source</h6>
          <XMarkIcon />
        </div>
        <div className="flex h-[1.2rem] w-5/12 justify-evenly bg-slate-300">
          <EyeSlashIcon />
          <h6>name</h6>
          <XMarkIcon />
        </div>
      </div>
      <div className="mt-2 flex h-[1.2rem] w-1/6 justify-evenly bg-slate-300">
        <PlusIcon />
        <h5>Add new field</h5>
      </div>
    </div>
  );
}
