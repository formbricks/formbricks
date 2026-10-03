"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { RestrictedSurveyHint } from "@/modules/survey/visibility/components/restricted-survey-hint";
import { isRestrictedSurveyPick } from "@/modules/survey/visibility/lib/outbound";
import { Checkbox } from "@/modules/ui/components/checkbox";

interface SurveyCheckboxGroupProps {
  surveys: TSurvey[];
  selectedSurveys: string[];
  selectedAllSurveys: boolean;
  onSelectAllSurveys: () => void;
  onSelectedSurveyChange: (surveyId: string) => void;
  allowChanges: boolean;
  /** ENG-3395: the restricted-surveys gate. With it on, a restricted survey cannot be newly selected. */
  surveyVisibilityEnabled: boolean;
  /** The webhook's saved surveys: a restricted one among them stays selectable so it can be removed. */
  attachedSurveyIds?: string[];
}

export const SurveyCheckboxGroup: React.FC<Readonly<SurveyCheckboxGroupProps>> = ({
  surveys,
  selectedSurveys,
  selectedAllSurveys,
  onSelectAllSurveys,
  onSelectedSurveyChange,
  allowChanges,
  surveyVisibilityEnabled,
  attachedSurveyIds,
}) => {
  const { t } = useTranslation();
  return (
    <div className="mt-1 max-h-[15vh] overflow-y-auto rounded-lg border border-slate-200">
      <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
        <div className="my-1 flex items-center gap-x-2">
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
            <span className="ml-2">{t("workspace.integrations.webhooks.all_current_and_new_surveys")}</span>
          </label>
        </div>
        {surveyVisibilityEnabled && selectedAllSurveys && (
          <p className="text-xs text-slate-500">
            {t("workspace.surveys.visibility.all_surveys_skip_restricted")}
          </p>
        )}
        {surveys.map((survey) => {
          const isRestrictedPick = isRestrictedSurveyPick(surveyVisibilityEnabled, survey, attachedSurveyIds);
          const isDisabled = selectedAllSurveys || !allowChanges || isRestrictedPick;
          return (
            <div key={survey.id} className="my-1 flex items-center gap-x-2">
              <label
                htmlFor={survey.id}
                className={`flex items-center ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                <Checkbox
                  type="button"
                  id={survey.id}
                  value={survey.id}
                  className="bg-white"
                  checked={selectedSurveys.includes(survey.id) && !selectedAllSurveys}
                  disabled={isDisabled}
                  onCheckedChange={() => {
                    if (!isDisabled) {
                      onSelectedSurveyChange(survey.id);
                    }
                  }}
                />
                <span className="ml-2">{survey.name}</span>
              </label>
              {isRestrictedPick && <RestrictedSurveyHint kind="restricted" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
