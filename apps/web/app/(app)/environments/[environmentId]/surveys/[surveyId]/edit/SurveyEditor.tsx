"use client";

import { useEffect, useState } from "react";
import PreviewSurvey from "../../PreviewSurvey";
import SettingsView from "./SettingsView";
import QuestionsAudienceTabs from "./QuestionsAudienceTabs";
import QuestionsView from "./QuestionsView";
import SurveyMenuBar from "./SurveyMenuBar";
import { TProduct } from "@formbricks/types/v1/product";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { TEnvironment } from "@formbricks/types/v1/environment";

interface SurveyEditorProps {
  survey : TSurveyWithAnalytics,
  product : TProduct,
  environment : TEnvironment
}

export default function SurveyEditor({ survey,product, environment }: SurveyEditorProps): JSX.Element {
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurveyWithAnalytics>();
  const [invalidQuestions, setInvalidQuestions] = useState<String[] | null>(null);

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

  return (
    <>
    {localSurvey && <div className="flex h-full flex-col">
      <SurveyMenuBar
        setLocalSurvey={setLocalSurvey}
        localSurvey={localSurvey}
        survey={survey}
        environmentId={environment.id}
        activeId={activeView}
        setActiveId={setActiveView}
        setInvalidQuestions={setInvalidQuestions}
        product={product}
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
              environmentId={environment.id}
              invalidQuestions={invalidQuestions}
              setInvalidQuestions={setInvalidQuestions}
            />
          ) : (
            <SettingsView
              environmentId={environment.id}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
            />
          )}
        </main>
        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 py-6  md:flex md:flex-col">
          <PreviewSurvey
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            questions={localSurvey.questions}
            brandColor={product.brandColor}
            environmentId={environment.id}
            product={product}
            environment={environment}
            surveyType={localSurvey.type}
            thankYouCard={localSurvey.thankYouCard}
            previewType={localSurvey.type === "web" ? "modal" : "fullwidth"}
            autoClose={localSurvey.autoClose}
          />
        </aside>
      </div>
    </div>}
    </>
  );
}
