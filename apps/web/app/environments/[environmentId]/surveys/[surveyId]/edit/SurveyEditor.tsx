"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useSurvey } from "@/lib/surveys/surveys";
import type { Survey } from "@formbricks/types/surveys";
import { ErrorComponent } from "@formbricks/ui";
import { useEffect, useState } from "react";
import PreviewSurvey from "../../PreviewSurvey";
import SettingsView from "./SettingsView";
import QuestionsAudienceTabs from "./QuestionsAudienceTabs";
import QuestionsView from "./QuestionsView";
import SurveyMenuBar from "./SurveyMenuBar";

interface SurveyEditorProps {
  environmentId: string;
  surveyId: string;
}

export default function SurveyEditor({ environmentId, surveyId }: SurveyEditorProps): JSX.Element {
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<Survey | null>();

  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  useEffect(() => {
    if (survey) {
      if (!localSurvey) {
        setLocalSurvey(survey);
      }

      if (!activeQuestionId && survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  if (isLoadingSurvey || isLoadingProduct || !localSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorSurvey || isErrorProduct) {
    return <ErrorComponent />;
  }

  return (
    <div className="flex h-full flex-col">
      <SurveyMenuBar
        setLocalSurvey={setLocalSurvey}
        localSurvey={localSurvey}
        survey={survey}
        environmentId={environmentId}
        activeId={activeView}
        setActiveId={setActiveView}
      />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none">
          <QuestionsAudienceTabs activeId={activeView} setActiveId={setActiveView} />
          {activeView === "questions" ? (
            <QuestionsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              activeQuestionId={activeQuestionId}
              setActiveQuestionId={setActiveQuestionId}
              environmentId={environmentId}
            />
          ) : (
            <SettingsView
              environmentId={environmentId}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
            />
          )}
        </main>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 py-2  md:flex md:flex-col">
          <PreviewSurvey
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            questions={localSurvey.questions}
            brandColor={product.brandColor}
            environmentId={environmentId}
            surveyType={localSurvey.type}
            thankYouCard={localSurvey.thankYouCard}
            previewType={localSurvey.type === "web" ? "modal" : "fullwidth"}
            autoClose={localSurvey.autoClose}
          />
        </aside>
      </div>
    </div>
  );
}
