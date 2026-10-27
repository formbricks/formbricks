"use client";

import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  getWebhookSurveyOptions,
  mergePickedSurveyIds,
} from "@/modules/integrations/webhooks/lib/survey-options";
import { RestrictedSurveysNote } from "@/modules/survey/visibility/components/restricted-survey-hint";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { MultiSelect } from "@/modules/ui/components/multi-select";

interface SurveySelectProps {
  surveys: TSurvey[];
  selectedSurveys: string[];
  selectedAllSurveys: boolean;
  onSelectAllSurveys: () => void;
  onSelectedSurveysChange: (surveyIds: string[]) => void;
  allowChanges: boolean;
  /** ENG-3395: the restricted-surveys gate. With it on, a restricted survey cannot be newly selected. */
  surveyVisibilityEnabled: boolean;
  /** The webhook's saved surveys: a restricted one among them stays selectable so it can be removed. */
  attachedSurveyIds?: string[];
}

export const SurveySelect = ({
  surveys,
  selectedSurveys,
  selectedAllSurveys,
  onSelectAllSurveys,
  onSelectedSurveysChange,
  allowChanges,
  surveyVisibilityEnabled,
  attachedSurveyIds,
}: Readonly<SurveySelectProps>) => {
  const { t } = useTranslation();
  const options = getWebhookSurveyOptions(
    surveys,
    surveyVisibilityEnabled,
    t("workspace.surveys.visibility.restricted"),
    attachedSurveyIds
  );

  return (
    <div className="mt-1 space-y-2">
      <label
        htmlFor="allSurveys"
        className={`flex w-fit items-center text-sm text-slate-900 ${
          allowChanges ? "cursor-pointer" : "cursor-not-allowed opacity-50"
        }`}>
        <Checkbox
          type="button"
          id="allSurveys"
          value=""
          checked={selectedAllSurveys}
          onCheckedChange={onSelectAllSurveys}
          disabled={!allowChanges}
        />
        <span className="ml-2">{t("workspace.integrations.webhooks.all_current_and_new_surveys")}</span>
      </label>
      {surveyVisibilityEnabled && selectedAllSurveys && (
        <p className="text-xs text-slate-500">
          {t("workspace.surveys.visibility.all_surveys_skip_restricted")}
        </p>
      )}
      <MultiSelect
        options={options}
        value={selectedAllSurveys ? [] : selectedSurveys}
        onChange={(picked) =>
          onSelectedSurveysChange(
            mergePickedSurveyIds(
              selectedSurveys,
              picked,
              options.map((option) => option.value)
            )
          )
        }
        disabled={selectedAllSurveys || !allowChanges}
        placeholder={t("workspace.surveys.search_by_survey_name")}
      />
      {!selectedAllSurveys && (
        <RestrictedSurveysNote
          surveyVisibilityEnabled={surveyVisibilityEnabled}
          surveys={surveys}
          attachedSurveyIds={attachedSurveyIds}
        />
      )}
    </div>
  );
};
