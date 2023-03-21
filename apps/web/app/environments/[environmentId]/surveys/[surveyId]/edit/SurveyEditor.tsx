"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useSurvey } from "@/lib/surveys/surveys";
import type { Question } from "@/types/questions";
import { useEffect, useState } from "react";
import AudienceView from "./AudienceView";
import Preview from "./Preview";
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

  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  useEffect(() => {
    if (survey) {
      setQuestions(survey.questions);
      setTriggers(survey.triggers.map((trigger) => trigger.eventClassId));
      if (!activeQuestionId && survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  if (isLoadingSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorSurvey) {
    return <div>Error</div>;
  }

  return (
    <div className="h-full">
      <SurveyMenuBar
        questions={questions}
        triggers={triggers}
        environmentId={environmentId}
        surveyId={surveyId}
      />
      <div className="relative z-0 flex h-full flex-1 overflow-hidden">
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
            <AudienceView environmentId={environmentId} triggers={triggers} setTriggers={setTriggers} />
          )}
        </main>
        <aside className="relative hidden h-full w-96 flex-shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-200 shadow-inner md:flex md:flex-col">
          <Preview activeQuestionId={activeQuestionId} questions={questions} />
        </aside>
      </div>
    </div>
  );
}
