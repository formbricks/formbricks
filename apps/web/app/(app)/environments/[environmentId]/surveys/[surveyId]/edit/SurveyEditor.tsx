"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useSurvey } from "@/lib/surveys/surveys";
import type { Survey } from "@formbricks/types/surveys";
import { ErrorComponent } from "@formbricks/ui";
import { useEffect, useState } from "react";
import PreviewSurvey from "../../PreviewSurvey";
import QuestionsAudienceTabs from "./QuestionsSettingsTabs";
import QuestionsView from "./QuestionsView";
import SettingsView from "./SettingsView";
import SurveyMenuBar from "./SurveyMenuBar";
import { TEnvironment } from "@formbricks/types/v1/environment";

interface SurveyEditorProps {
  environmentId: string;
  surveyId: string;
  environment: TEnvironment;
}

export default function SurveyEditor({
  environmentId,
  surveyId,
  environment,
}: SurveyEditorProps): JSX.Element {
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<Survey | null>();
  const [invalidQuestions, setInvalidQuestions] = useState<String[] | null>(null);
  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId, true);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  useEffect(() => {
    if (survey) {
      setLocalSurvey(survey);

      if (survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  // when the survey type changes, we need to reset the active question id to the first question
  useEffect(() => {
    if (survey?.questions?.length > 0) {
      setActiveQuestionId(survey.questions[0].id);
    }
  }, [localSurvey?.type]);

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
        environment={environment}
        activeId={activeView}
        setActiveId={setActiveView}
        setInvalidQuestions={setInvalidQuestions}
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
              invalidQuestions={invalidQuestions}
              setInvalidQuestions={setInvalidQuestions}
            />
          ) : (
            <SettingsView
              environmentId={environmentId}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
            />
          )}
        </main>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 py-6  md:flex md:flex-col">
          <PreviewSurvey
            survey={localSurvey}
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            environmentId={environmentId}
            product={product}
            environment={environment}
            previewType={localSurvey.type === "web" ? "modal" : "fullwidth"}
          />
        </aside>
      </div>
    </div>
  );
}
