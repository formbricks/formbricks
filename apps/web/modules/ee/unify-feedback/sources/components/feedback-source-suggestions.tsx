"use client";

import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TUnifySurvey } from "../types";
import { getDismissedStorageKey } from "../utils";
import { getFeedbackSourceIcon } from "./feedback-source-display";

interface FeedbackSourceSuggestionsProps {
  /** Surveys in the workspace that aren't connected as a feedback source yet. */
  suggestedSurveys: TUnifySurvey[];
  workspaceId: string;
  onImportResponses: (survey: TUnifySurvey) => Promise<void>;
  onSelectQuestions: (survey: TUnifySurvey) => void;
}

export function FeedbackSourceSuggestions({
  suggestedSurveys,
  workspaceId,
  onImportResponses,
  onSelectQuestions,
}: Readonly<FeedbackSourceSuggestionsProps>) {
  const { t } = useTranslation();
  const [importingSurveyId, setImportingSurveyId] = useState<string | null>(null);
  // Dismissed suggestions are remembered per workspace in localStorage (like the table column settings).
  // Loaded in an effect to avoid a hydration mismatch between server and client render.
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    const key = getDismissedStorageKey(workspaceId);
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setDismissedIds(parsed.filter((id): id is string => typeof id === "string"));
        return;
      }
    } catch {
      // fall through to cleanup
    }
    // Unparseable or wrong-shape value — drop it so it doesn't fail to parse on every mount.
    localStorage.removeItem(key);
  }, [workspaceId]);

  const visibleSurveys = suggestedSurveys.filter((survey) => !dismissedIds.includes(survey.id));

  if (visibleSurveys.length === 0) {
    return null;
  }

  const handleImport = async (survey: TUnifySurvey) => {
    setImportingSurveyId(survey.id);
    try {
      await onImportResponses(survey);
    } finally {
      setImportingSurveyId(null);
    }
  };

  const handleDismiss = (surveyId: string) => {
    if (dismissedIds.includes(surveyId)) return;
    const next = [...dismissedIds, surveyId];
    setDismissedIds(next);
    localStorage.setItem(getDismissedStorageKey(workspaceId), JSON.stringify(next));
  };

  return (
    // Separate the suggestions from the connected-source rows above, and cap the height so a long list
    // scrolls instead of pushing the page down.
    <div className="max-h-80 overflow-y-auto border-t border-slate-200">
      {visibleSurveys.map((survey) => {
        const isImporting = importingSurveyId === survey.id;
        const isBusy = importingSurveyId !== null;
        return (
          <div
            key={survey.id}
            className="m-2 grid h-12 min-h-12 grid-cols-12 content-center rounded-md bg-slate-50 transition-colors ease-in-out">
            <div className="col-span-6 flex min-w-0 items-center gap-2 pl-6">
              {getFeedbackSourceIcon("formbricks_survey", "h-4 w-4 shrink-0 text-slate-500")}
              <span className="truncate text-sm font-medium text-slate-900">{survey.name}</span>
              <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {t("workspace.unify.suggestion")}
              </span>
            </div>
            <div className="col-span-6 flex items-center justify-end gap-2 pr-4">
              <Button
                variant="outline"
                size="sm"
                className="bg-white"
                disabled={isBusy}
                onClick={() => onSelectQuestions(survey)}>
                {t("workspace.unify.select_questions_for_import")}
              </Button>
              <Button size="sm" loading={isImporting} disabled={isBusy} onClick={() => handleImport(survey)}>
                {t("workspace.unify.import_responses")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 text-slate-500 hover:text-slate-900"
                disabled={isBusy}
                aria-label={t("workspace.unify.dismiss")}
                title={t("workspace.unify.dismiss")}
                onClick={() => handleDismiss(survey.id)}>
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
