"use client";

import { PlusIcon } from "lucide-react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TSurvey } from "@formbricks/types/surveys/types";

interface AddEndingCardButtonProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
}

export const AddEndingCardButton = ({ localSurvey, setLocalSurvey }: AddEndingCardButtonProps) => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const addEndingCard = () => {
    const updatedSurvey = structuredClone(localSurvey);

    // Find the highest ID value among existing endings
    let highestId = 0;
    updatedSurvey.endings.forEach((ending) => {
      const idParts = ending.id.split(":");
      const idNumber = parseInt(idParts[1], 10);
      if (idNumber > highestId) {
        highestId = idNumber;
      }
    });

    // Create the new ending card with the incremented ID
    updatedSurvey.endings.push({
      type: "endScreen",
      enabled: true,
      headline: createI18nString("Thank you!", surveyLanguageCodes),
      subheader: createI18nString("We appreciate your feedback", surveyLanguageCodes),
      id: `end:${highestId + 1}`,
    });

    setLocalSurvey(updatedSurvey);
  };

  return (
    <div
      className="scale-97 inline-flex rounded-lg border border-slate-300 bg-white transition-all duration-300 ease-in-out hover:scale-100 hover:cursor-pointer hover:bg-slate-50"
      onClick={addEndingCard}>
      <div className="bg-brand-dark flex w-10 items-center justify-center rounded-l-lg group-aria-expanded:rounded-bl-none group-aria-expanded:rounded-br">
        <PlusIcon className="h-6 w-6 text-white" />
      </div>
      <div className="px-4 py-3">
        <p className="font-semibold">Add Ending Card</p>
        <p className="mt-1 text-sm text-slate-500">Add a ending to your survey</p>
      </div>
    </div>
  );
};
