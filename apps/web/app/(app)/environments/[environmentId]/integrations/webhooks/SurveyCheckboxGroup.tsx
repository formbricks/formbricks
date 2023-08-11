import React from "react";
import { Checkbox } from "@formbricks/ui";
import { TSurvey } from "@formbricks/types/v1/surveys";

interface SurveyCheckboxGroupProps {
  surveys: TSurvey[];
  selectedSurveys: string[];
  selectedAllSurveys: boolean;
  onSelectAllSurveys: () => void;
  onSelectedSurveyChange: (surveyId: string) => void;
}

export const SurveyCheckboxGroup: React.FC<SurveyCheckboxGroupProps> = ({
  surveys,
  selectedSurveys,
  selectedAllSurveys,
  onSelectAllSurveys,
  onSelectedSurveyChange,
}) => {
  return (
    <div className="mt-1 rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
        <div className="my-1 flex items-center space-x-2">
          <Checkbox
            type="button"
            id="allSurveys"
            className="bg-white"
            value=""
            checked={selectedAllSurveys}
            onCheckedChange={onSelectAllSurveys}
          />
          <label
            htmlFor="allSurveys"
            className={`flex cursor-pointer items-center ${selectedAllSurveys ? "font-semibold" : ""}`}>
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
              disabled={selectedAllSurveys}
              onCheckedChange={() => onSelectedSurveyChange(survey.id)}
            />
            <label
              htmlFor={survey.id}
              className={`flex cursor-pointer items-center ${
                selectedAllSurveys ? "cursor-not-allowed opacity-50" : ""
              }`}>
              {survey.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveyCheckboxGroup;
