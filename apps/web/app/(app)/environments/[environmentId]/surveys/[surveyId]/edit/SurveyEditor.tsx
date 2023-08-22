"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
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
import { createUserSegmentAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { sampleUserSegment } from "@formbricks/types/v1/userSegment";

interface SurveyEditorProps {
  environmentId: string;
  surveyId: string;
}

export default function SurveyEditor({ environmentId, surveyId }: SurveyEditorProps): JSX.Element {
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<Survey | null>();
  const [isCreatingUserSegment, setIsCreatingUserSegment] = useState(true);
  const [isUserSegmentError, setIsUserSegmentError] = useState(false);
  const [invalidQuestions, setInvalidQuestions] = useState<String[] | null>(null);
  const { survey, isLoadingSurvey, isErrorSurvey, mutateSurvey } = useSurvey(environmentId, surveyId, true);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  useEffect(() => {
    if (survey) {
      setLocalSurvey(survey);

      if (survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  useEffect(() => {
    const createUserSegment = async () => {
      try {
        await createUserSegmentAction(environmentId, surveyId, "", "", sampleUserSegment.filters);
        setIsCreatingUserSegment(false);
        mutateSurvey();
      } catch (err) {
        setIsUserSegmentError(true);
        setIsCreatingUserSegment(false);
      }
    };

    if (survey && !survey.userSegment) {
      setIsCreatingUserSegment(true);
      createUserSegment();
    } else {
      setIsCreatingUserSegment(false);
    }
  }, [environmentId, mutateSurvey, survey, surveyId]);

  if (isLoadingSurvey || isLoadingProduct || isLoadingEnvironment || !localSurvey || isCreatingUserSegment) {
    return <LoadingSpinner />;
  }

  if (isErrorSurvey || isErrorProduct || isErrorEnvironment || isUserSegmentError) {
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
        {/* <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 py-6  md:flex md:flex-col">
          <PreviewSurvey
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            questions={localSurvey.questions}
            brandColor={product.brandColor}
            environmentId={environmentId}
            product={product}
            environment={environment}
            surveyType={localSurvey.type}
            thankYouCard={localSurvey.thankYouCard}
            previewType={localSurvey.type === "web" ? "modal" : "fullwidth"}
            autoClose={localSurvey.autoClose}
          />
        </aside> */}
      </div>
    </div>
  );
}
