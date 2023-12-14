"use client";

import Loading from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/loading";
import React from "react";
import { useEffect, useState } from "react";

import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

import PreviewSurvey from "../../../components/PreviewSurvey";
import QuestionsAudienceTabs from "./QuestionsSettingsTabs";
import QuestionsView from "./QuestionsView";
import SettingsView from "./SettingsView";
import SurveyMenuBar from "./SurveyMenuBar";

interface SurveyEditorProps {
  survey: TSurvey;
  product: TProduct;
  environment: TEnvironment;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  responseCount: number;
  membershipRole?: TMembershipRole;
  colours: string[];
}

export default function SurveyEditor({
  survey,
  product,
  environment,
  actionClasses,
  attributeClasses,
  responseCount,
  membershipRole,
  colours,
}: SurveyEditorProps): JSX.Element {
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>();
  const [invalidQuestions, setInvalidQuestions] = useState<String[] | null>(null);

  useEffect(() => {
    if (survey) {
      if (localSurvey) return;
      setLocalSurvey(JSON.parse(JSON.stringify(survey)));

      if (survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  // when the survey type changes, we need to reset the active question id to the first question
  useEffect(() => {
    if (localSurvey?.questions?.length && localSurvey.questions.length > 0) {
      setActiveQuestionId(localSurvey.questions[0].id);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey?.type]);

  if (!localSurvey) {
    return <Loading />;
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <SurveyMenuBar
          setLocalSurvey={setLocalSurvey}
          localSurvey={localSurvey}
          survey={survey}
          environment={environment}
          activeId={activeView}
          setActiveId={setActiveView}
          setInvalidQuestions={setInvalidQuestions}
          product={product}
          responseCount={responseCount}
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
                product={product}
                invalidQuestions={invalidQuestions}
                setInvalidQuestions={setInvalidQuestions}
              />
            ) : (
              <SettingsView
                environment={environment}
                localSurvey={localSurvey}
                setLocalSurvey={setLocalSurvey}
                actionClasses={actionClasses}
                attributeClasses={attributeClasses}
                responseCount={responseCount}
                membershipRole={membershipRole}
                colours={colours}
              />
            )}
          </main>
          <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 py-6  md:flex md:flex-col">
            <PreviewSurvey
              survey={localSurvey}
              setActiveQuestionId={setActiveQuestionId}
              activeQuestionId={activeQuestionId}
              product={product}
              environment={environment}
              previewType={localSurvey.type === "web" ? "modal" : "fullwidth"}
              onFileUpload={async (file) => file.name}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
