"use client";

import { CheckIcon, ChevronRightIcon, FileTextIcon, MessageSquareTextIcon, StarIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { UNSUPPORTED_CONNECTOR_ELEMENT_TYPES } from "@formbricks/types/connector";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";
import { Badge } from "@/modules/ui/components/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { TUnifySurvey } from "../types";

interface FormbricksSurveySelectorProps {
  surveys: TUnifySurvey[];
  selectedSurveyId: string | null;
  selectedElementIds: string[];
  onSurveySelect: (surveyId: string | null) => void;
  onElementToggle: (elementId: string) => void;
  onSelectAllElements: (surveyId: string) => void;
  onDeselectAllElements: () => void;
}

const getElementIcon = (type: TSurveyElementTypeEnum) => {
  switch (type) {
    case "openText":
      return <MessageSquareTextIcon className="h-4 w-4 text-slate-500" />;
    case "rating":
    case "nps":
      return <StarIcon className="h-4 w-4 text-amber-500" />;
    default:
      return <FileTextIcon className="h-4 w-4 text-slate-500" />;
  }
};

const isUnsupportedType = (type: TSurveyElementTypeEnum): boolean => {
  return UNSUPPORTED_CONNECTOR_ELEMENT_TYPES.includes(type);
};

export const FormbricksSurveySelector = ({
  surveys,
  selectedSurveyId,
  selectedElementIds,
  onSurveySelect,
  onElementToggle,
  onSelectAllElements,
  onDeselectAllElements,
}: FormbricksSurveySelectorProps) => {
  const { t } = useTranslation();

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);
  const supportedElements = selectedSurvey?.elements.filter((e) => !isUnsupportedType(e.type)) ?? [];
  const allSupportedSelected =
    supportedElements.length > 0 && supportedElements.every((e) => selectedElementIds.includes(e.id));

  const handleSurveyClick = (survey: TUnifySurvey) => {
    if (selectedSurveyId !== survey.id) {
      onSurveySelect(survey.id);
    }
  };

  const handleSelectAllSupported = (surveyId: string) => {
    onSelectAllElements(surveyId);
  };

  const getStatusBadge = (status: TUnifySurvey["status"]) => {
    switch (status) {
      case "active":
        return <Badge text={t("environments.unify.status_active")} type="success" size="tiny" />;
      case "paused":
        return <Badge text={t("environments.unify.status_paused")} type="warning" size="tiny" />;
      case "draft":
        return <Badge text={t("environments.unify.status_draft")} type="gray" size="tiny" />;
      case "completed":
        return <Badge text={t("environments.unify.status_completed")} type="gray" size="tiny" />;
      default:
        return null;
    }
  };

  const getSupportedElementCount = (survey: TUnifySurvey) =>
    survey.elements.filter((e) => !isUnsupportedType(e.type)).length;

  return (
    <div className="grid h-[50vh] grid-cols-2 gap-6">
      {/* Left: Survey List */}
      <div className="flex flex-col gap-3 overflow-hidden">
        <h4 className="shrink-0 text-sm font-medium text-slate-700">
          {t("environments.unify.select_survey")}
        </h4>
        <div className="space-y-2 overflow-y-auto pr-1">
          {surveys.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm text-slate-500">{t("environments.unify.no_surveys_found")}</p>
            </div>
          ) : (
            surveys.map((survey) => {
              const isSelected = selectedSurveyId === survey.id;

              return (
                <div key={survey.id}>
                  <button
                    type="button"
                    onClick={() => handleSurveyClick(survey)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-brand-dark bg-slate-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{survey.name}</span>
                        {getStatusBadge(survey.status)}
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("environments.unify.n_supported_questions", {
                          count: getSupportedElementCount(survey),
                        })}
                      </p>
                    </div>
                    {isSelected && <ChevronRightIcon className="text-brand-dark h-5 w-5 shrink-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Element Selection */}
      <div className="flex flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700">{t("environments.unify.select_questions")}</h4>
          {selectedSurvey && supportedElements.length > 0 && (
            <button
              type="button"
              onClick={() =>
                allSupportedSelected ? onDeselectAllElements() : handleSelectAllSupported(selectedSurvey.id)
              }
              className="text-xs text-slate-500 hover:text-slate-700">
              {allSupportedSelected
                ? t("environments.unify.deselect_all")
                : t("environments.unify.select_all")}
            </button>
          )}
        </div>

        {!selectedSurvey ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <p className="text-sm text-slate-500">
              {t("environments.unify.select_a_survey_to_see_questions")}
            </p>
          </div>
        ) : selectedSurvey.elements.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <p className="text-sm text-slate-500">{t("environments.unify.survey_has_no_questions")}</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1">
            <TooltipProvider delayDuration={200}>
              {selectedSurvey.elements.map((element) => {
                const isSelected = selectedElementIds.includes(element.id);
                const unsupported = isUnsupportedType(element.type);

                const button = (
                  <button
                    key={element.id}
                    type="button"
                    disabled={unsupported}
                    onClick={() => onElementToggle(element.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      unsupported
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50"
                        : isSelected
                          ? "border-green-300 bg-green-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                    }`}>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded ${
                        unsupported
                          ? "border border-slate-200 bg-slate-100"
                          : isSelected
                            ? "bg-green-500 text-white"
                            : "border border-slate-300 bg-white"
                      }`}>
                      {isSelected && !unsupported && <CheckIcon className="h-3 w-3" />}
                    </div>
                    <div className="flex items-center gap-2">{getElementIcon(element.type)}</div>
                    <div className="flex-1">
                      <p className={`text-sm ${unsupported ? "text-slate-400" : "text-slate-900"}`}>
                        {element.headline}
                      </p>
                      <span className={`text-xs ${unsupported ? "text-slate-300" : "text-slate-500"}`}>
                        {getTSurveyElementTypeEnumName(element.type, t) ?? element.type}
                      </span>
                    </div>
                  </button>
                );

                if (unsupported) {
                  return (
                    <Tooltip key={element.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent>{t("environments.unify.question_type_not_supported")}</TooltipContent>
                    </Tooltip>
                  );
                }

                return button;
              })}
            </TooltipProvider>

            {selectedElementIds.length > 0 && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  <Trans
                    i18nKey={
                      selectedElementIds.length === 1
                        ? "environments.unify.question_selected"
                        : "environments.unify.questions_selected"
                    }
                    values={{ count: selectedElementIds.length }}
                    components={{ strong: <strong /> }}
                  />
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
