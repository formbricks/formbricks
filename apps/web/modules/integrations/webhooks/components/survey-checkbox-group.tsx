"use client";

import { Checkbox } from "@/modules/ui/components/checkbox";
import { useTranslate } from "@tolgee/react";
import React from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SurveyCheckboxGroupProps {
  surveys: TSurvey[];
  selectedSurveys: string[];
  selectedAllSurveys: boolean;
  onSelectAllSurveys: () => void;
  onSelectedSurveyChange: (surveyId: string) => void;
  allowChanges: boolean;
}

export const SurveyCheckboxGroup: React.FC<SurveyCheckboxGroupProps> = ({
  surveys,
  selectedSurveys,
  selectedAllSurveys,
  onSelectAllSurveys,
  onSelectedSurveyChange,
  allowChanges,
}) => {
  const { t } = useTranslate();
  return (
    <div className="mt-1 max-h-[15vh] overflow-y-auto rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
        <div className="my-1 flex items-center space-x-2">
          <label
            htmlFor="allSurveys"
            className={`flex items-center ${selectedAllSurveys ? "font-semibold" : ""} ${
              !allowChanges ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}>
            <Checkbox
              type="button"
              id="allSurveys"
              className="bg-white"
              value=""
              checked={selectedAllSurveys}
              onCheckedChange={onSelectAllSurveys}
              disabled={!allowChanges}
            />
            <span className="ml-2">
              {t("environments.integrations.webhooks.all_current_and_new_surveys")}
            </span>
          </label>
        </div>
        {surveys.map((survey) => (
          <div key={survey.id} className="my-1 flex items-center space-x-2">
            <label
              htmlFor={survey.id}
              className={`flex items-center ${
                selectedAllSurveys || !allowChanges ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}>
              <Checkbox
                type="button"
                id={survey.id}
                value={survey.id}
                className="bg-white"
                checked={selectedSurveys.includes(survey.id) && !selectedAllSurveys}
                disabled={selectedAllSurveys || !allowChanges}
                onCheckedChange={() => {
                  if (allowChanges) {
                    onSelectedSurveyChange(survey.id);
                  }
                }}
              />
              <span className="ml-2">{survey.name}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
