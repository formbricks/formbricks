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
      className="scale-97 inline-flex rounded-lg border border-slate-300 bg-white transition-all duration-300 ease-in-out hover:scale-100 hover:cursor-pointer hover:bg-slate-50"
      onClick={() => addEndingCard(localSurvey.endings.length)}>
      <div className="bg-brand-dark flex w-10 items-center justify-center rounded-l-lg group-aria-expanded:rounded-bl-none group-aria-expanded:rounded-br">
        <PlusIcon className="h-6 w-6 text-white" />
      </div>
      <div className="px-4 py-3">
        <p className="font-semibold">Add Ending Card</p>
        <p className="mt-1 text-sm text-slate-500">Add an ending to your survey</p>
      </div>
    </div>
  );
};
