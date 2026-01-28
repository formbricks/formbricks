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
import { Badge } from "@/modules/ui/components/badge";
import {
  MOCK_FORMBRICKS_SURVEYS,
  TFormbricksSurvey,
  TFormbricksSurveyQuestion,
  getQuestionTypeLabel,
} from "./types";

interface FormbricksSurveySelectorProps {
  selectedSurveyId: string | null;
  selectedQuestionIds: string[];
  onSurveySelect: (surveyId: string | null) => void;
  onQuestionToggle: (questionId: string) => void;
  onSelectAllQuestions: (surveyId: string) => void;
  onDeselectAllQuestions: () => void;
}

function getQuestionIcon(type: TFormbricksSurveyQuestion["type"]) {
  switch (type) {
    case "openText":
      return <MessageSquareTextIcon className="h-4 w-4 text-slate-500" />;
    case "rating":
    case "nps":
    case "csat":
      return <StarIcon className="h-4 w-4 text-amber-500" />;
    default:
      return <FileTextIcon className="h-4 w-4 text-slate-500" />;
  }
}

function getStatusBadge(status: TFormbricksSurvey["status"]) {
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
  selectedSurveyId,
  selectedQuestionIds,
  onSurveySelect,
  onQuestionToggle,
  onSelectAllQuestions,
  onDeselectAllQuestions,
}: FormbricksSurveySelectorProps) {
  const [expandedSurveyId, setExpandedSurveyId] = useState<string | null>(null);

  const selectedSurvey = MOCK_FORMBRICKS_SURVEYS.find((s) => s.id === selectedSurveyId);

  const handleSurveyClick = (survey: TFormbricksSurvey) => {
    if (selectedSurveyId === survey.id) {
      // Toggle expand/collapse if already selected
      setExpandedSurveyId(expandedSurveyId === survey.id ? null : survey.id);
    } else {
      // Select the survey and expand it
      onSurveySelect(survey.id);
      onDeselectAllQuestions();
      setExpandedSurveyId(survey.id);
    }
  };

  const allQuestionsSelected =
    selectedSurvey && selectedQuestionIds.length === selectedSurvey.questions.length;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Survey List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-700">Select Survey</h4>
        <div className="space-y-2">
          {MOCK_FORMBRICKS_SURVEYS.map((survey) => {
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
                    <p className="text-xs text-slate-500">
                      {survey.questions.length} questions · {survey.responseCount.toLocaleString()} responses
                    </p>
                  </div>
                  {isSelected && <CheckCircle2Icon className="text-brand-dark h-5 w-5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Question Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700">Select Questions</h4>
          {selectedSurvey && (
            <button
              type="button"
              onClick={() =>
                allQuestionsSelected ? onDeselectAllQuestions() : onSelectAllQuestions(selectedSurvey.id)
              }
              className="text-xs text-slate-500 hover:text-slate-700">
              {allQuestionsSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {!selectedSurvey ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <p className="text-sm text-slate-500">Select a survey to see its questions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedSurvey.questions.map((question) => {
              const isSelected = selectedQuestionIds.includes(question.id);

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onQuestionToggle(question.id)}
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
                  <div className="flex items-center gap-2">{getQuestionIcon(question.type)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-900">{question.headline}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{getQuestionTypeLabel(question.type)}</span>
                      {question.required && (
                        <span className="text-xs text-red-500">
                          <CircleIcon className="inline h-1.5 w-1.5 fill-current" /> Required
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {selectedQuestionIds.length > 0 && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  <strong>{selectedQuestionIds.length}</strong> question
                  {selectedQuestionIds.length !== 1 ? "s" : ""} selected. Each response to these questions
                  will create a FeedbackRecord in the Hub.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
