"use client";

import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  StarIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";
import { Badge } from "@/modules/ui/components/badge";
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

function getElementIcon(type: string) {
  switch (type) {
    case "openText":
      return <MessageSquareTextIcon className="h-4 w-4 text-slate-500" />;
    case "rating":
    case "nps":
      return <StarIcon className="h-4 w-4 text-amber-500" />;
    default:
      return <FileTextIcon className="h-4 w-4 text-slate-500" />;
  }
}

function getStatusBadge(status: TUnifySurvey["status"]) {
  switch (status) {
    case "active":
      return <Badge text="Active" type="success" size="tiny" />;
    case "paused":
      return <Badge text="Paused" type="warning" size="tiny" />;
    case "draft":
      return <Badge text="Draft" type="gray" size="tiny" />;
    case "completed":
      return <Badge text="Completed" type="gray" size="tiny" />;
    default:
      return null;
  }
}

export function FormbricksSurveySelector({
  surveys,
  selectedSurveyId,
  selectedElementIds,
  onSurveySelect,
  onElementToggle,
  onSelectAllElements,
  onDeselectAllElements,
}: FormbricksSurveySelectorProps) {
  const { t } = useTranslation();
  const [expandedSurveyId, setExpandedSurveyId] = useState<string | null>(null);

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);

  const handleSurveyClick = (survey: TUnifySurvey) => {
    if (selectedSurveyId === survey.id) {
      // Toggle expand/collapse if already selected
      setExpandedSurveyId(expandedSurveyId === survey.id ? null : survey.id);
    } else {
      // Select the survey and expand it
      onSurveySelect(survey.id);
      onDeselectAllElements();
      setExpandedSurveyId(survey.id);
    }
  };

  const allElementsSelected = selectedSurvey && selectedElementIds.length === selectedSurvey.elements.length;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Survey List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-700">Select Survey</h4>
        <div className="space-y-2">
          {surveys.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm text-slate-500">No surveys found in this environment</p>
            </div>
          ) : (
            surveys.map((survey) => {
              const isSelected = selectedSurveyId === survey.id;
              const isExpanded = expandedSurveyId === survey.id;

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
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4 text-slate-600" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{survey.name}</span>
                        {getStatusBadge(survey.status)}
                      </div>
                      <p className="text-xs text-slate-500">{survey.elements.length} elements</p>
                    </div>
                    {isSelected && <CheckCircle2Icon className="text-brand-dark h-5 w-5" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Element Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700">Select Elements</h4>
          {selectedSurvey && (
            <button
              type="button"
              onClick={() =>
                allElementsSelected ? onDeselectAllElements() : onSelectAllElements(selectedSurvey.id)
              }
              className="text-xs text-slate-500 hover:text-slate-700">
              {allElementsSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {!selectedSurvey ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <p className="text-sm text-slate-500">Select a survey to see its elements</p>
          </div>
        ) : selectedSurvey.elements.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <p className="text-sm text-slate-500">This survey has no question elements</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedSurvey.elements.map((element) => {
              const isSelected = selectedElementIds.includes(element.id);

              return (
                <button
                  key={element.id}
                  type="button"
                  onClick={() => onElementToggle(element.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-green-300 bg-green-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}>
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded ${
                      isSelected ? "bg-green-500 text-white" : "border border-slate-300 bg-white"
                    }`}>
                    {isSelected && <CheckIcon className="h-3 w-3" />}
                  </div>
                  <div className="flex items-center gap-2">{getElementIcon(element.type)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-900">{element.headline}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {getTSurveyElementTypeEnumName(element.type, t) ?? element.type}
                      </span>
                      {element.required && (
                        <span className="text-xs text-red-500">
                          <CircleIcon className="inline h-1.5 w-1.5 fill-current" /> Required
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {selectedElementIds.length > 0 && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  <strong>{selectedElementIds.length}</strong> element
                  {selectedElementIds.length !== 1 ? "s" : ""} selected. Each response to these elements will
                  create a FeedbackRecord in the Hub.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
