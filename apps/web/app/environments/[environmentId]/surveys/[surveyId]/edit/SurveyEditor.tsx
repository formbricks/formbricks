"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useSurvey } from "@/lib/surveys/surveys";
import type { Question } from "@/types/questions";
import { useEffect, useState } from "react";
import PreviewSurvey from "../../PreviewSurvey";
import AudienceView from "./AudienceView";
import QuestionsAudienceTabs from "./QuestionsAudienceTabs";
import QuestionsView from "./QuestionsView";
import SurveyMenuBar from "./SurveyMenuBar";

interface SurveyEditorProps {
  environmentId: string;
  surveyId: string;
}

export default function SurveyEditor({ environmentId, surveyId }: SurveyEditorProps) {
  const [activeView, setActiveView] = useState<"questions" | "audience">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]); // list of eventClass Ids
  const [showSetting, setShowSetting] = useState<"once" | "always">("once");

  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  useEffect(() => {
    if (survey) {
      setQuestions(survey.questions);
      setTriggers(survey.triggers.map((trigger) => trigger.eventClassId));
      setShowSetting(survey.show);
      if (!activeQuestionId && survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  if (isLoadingSurvey || isLoadingProduct) {
    return <LoadingSpinner />;
  }

  if (isErrorSurvey || isErrorProduct) {
    return <div>Error</div>;
  }

  console.log(product);

  return (
    <div className="flex h-full flex-col">
      <SurveyMenuBar
        questions={questions}
        triggers={triggers}
        showSetting={showSetting}
        environmentId={environmentId}
        surveyId={surveyId}
      />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none">
          <QuestionsAudienceTabs activeId={activeView} setActiveId={setActiveView} />
          {activeView === "questions" ? (
            <QuestionsView
              questions={questions}
              setQuestions={setQuestions}
              activeQuestionId={activeQuestionId}
              setActiveQuestionId={setActiveQuestionId}
            />
          ) : (
            <AudienceView
              environmentId={environmentId}
              triggers={triggers}
              setTriggers={setTriggers}
              showSetting={showSetting}
              setShowSetting={setShowSetting}
            />
          )}
        </main>
        <aside className="relative hidden h-full flex-1 flex-shrink-0 overflow-hidden border-l border-slate-200 bg-slate-200 shadow-inner md:flex md:flex-col">
          <PreviewSurvey
            activeQuestionId={activeQuestionId}
            questions={questions}
            brandColor={product.brandColor}
          />
        </aside>
      </div>
    </div>
  );
}
