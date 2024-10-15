"use client";

import { PlusIcon } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface AddEndingCardButtonProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  addEndingCard: (index: number) => void;
}

export const AddEndingCardButton = ({ localSurvey, addEndingCard }: AddEndingCardButtonProps) => {
  return (
    <div
      className="group inline-flex rounded-lg border border-slate-300 bg-slate-50 hover:cursor-pointer hover:bg-white"
      onClick={() => addEndingCard(localSurvey.endings.length)}>
      <div className="flex w-10 items-center justify-center rounded-l-lg bg-slate-400 transition-all duration-300 ease-in-out group-hover:bg-slate-500 group-aria-expanded:rounded-bl-none group-aria-expanded:rounded-br">
        <PlusIcon className="h-6 w-6 text-white" />
      </div>
      <div className="px-4 py-3 text-sm">
        <p className="font-semibold">Add ending</p>
      </div>
    </div>
  );
};
