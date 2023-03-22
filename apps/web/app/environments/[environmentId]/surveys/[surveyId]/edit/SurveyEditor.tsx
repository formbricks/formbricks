"use client";

import { Survey } from "@/../../packages/js/dist/types/types";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useSurvey } from "@/lib/surveys/surveys";
import { useEffect, useState } from "react";
import AudienceView from "./AudienceView";
import PreviewQuestion from "./PreviewQuestion";
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
  /* const [questions, setQuestions] = useState<Question[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]); // list of eventClass Ids
  const [showSetting, setShowSetting] = useState<"once" | "always">("once");
 */
  const [localSurvey, setLocalSurvey] = useState<Survey | null>();

  const { survey, isLoadingSurvey, isErrorSurvey } = useSurvey(environmentId, surveyId);

  useEffect(() => {
    if (survey) {
      /* setQuestions(survey.questions);
      setTriggers(survey.triggers.map((trigger) => trigger.eventClassId));
      setShowSetting(survey.show); */
      if (!localSurvey) {
        setLocalSurvey(survey);
      } else {
        if (
          confirm(
            "This survey has been updated. Do you want to discard your changes and continue with the new version?"
          )
        ) {
          setLocalSurvey(survey);
        }
      }

      if (!activeQuestionId && survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  if (isLoadingSurvey || !localSurvey) {
    return <LoadingSpinner />;
  }

  if (isErrorSurvey) {
    return <div>Error</div>;
  }

  return (
    <div className="h-full">
      <SurveyMenuBar localSurvey={localSurvey} environmentId={environmentId} surveyId={surveyId} />
      <div className="relative z-0 flex h-full flex-1 overflow-hidden">
        <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none">
          <QuestionsAudienceTabs activeId={activeView} setActiveId={setActiveView} />
          {activeView === "questions" ? (
            <QuestionsView
              questions={localSurvey.questions}
              setLocalSurvey={setLocalSurvey}
              activeQuestionId={activeQuestionId}
              setActiveQuestionId={setActiveQuestionId}
            />
          ) : (
            <AudienceView
              environmentId={environmentId}
              localSurvey={localSurvey}
              /* triggers={localSurvey.triggers}
              setLocalSurvey={setLocalSurvey}
              showSetting={localSurvey.showSetting} */
              setLocalSurvey={setLocalSurvey}
            />
          )}
        </main>
        <aside className="relative hidden h-full w-96 flex-shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-200 shadow-inner md:flex md:flex-col">
          <PreviewQuestion
            activeQuestionId={activeQuestionId}
            questions={questions}
            lastQuestion={questions.findIndex((q) => q.id === activeQuestionId) === questions.length - 1}
          />
        </aside>
      </div>
    </div>
  );
}
