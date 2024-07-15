import React from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Checkbox } from "@formbricks/ui/Checkbox";

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
  return (
    <div className="mt-1 max-h-[15vh] overflow-y-auto rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
        <div className="my-1 flex items-center space-x-2">
          <Checkbox
            type="button"
            id="allSurveys"
            className="bg-white"
            value=""
            checked={selectedAllSurveys}
            onCheckedChange={onSelectAllSurveys}
            disabled={!allowChanges}
          />
          <label
            htmlFor="allSurveys"
            className={`flex cursor-pointer items-center ${selectedAllSurveys ? "font-semibold" : ""} ${
              !allowChanges ? "cursor-not-allowed opacity-50" : ""
            }`}>
            All current and new surveys
          </label>
        </div>
        {surveys.map((survey) => (
          <div key={survey.id} className="my-1 flex items-center space-x-2">
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
            <label
              htmlFor={survey.id}
              className={`flex cursor-pointer items-center ${
                selectedAllSurveys ? "cursor-not-allowed opacity-50" : ""
              } ${!allowChanges ? "cursor-not-allowed opacity-50" : ""}`}>
              {survey.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
