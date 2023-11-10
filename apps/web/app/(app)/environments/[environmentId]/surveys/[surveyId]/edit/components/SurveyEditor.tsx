"use client";

import React from "react";
import { useEffect, useState, useMemo } from "react";
import PreviewSurvey from "../../../components/PreviewSurvey";
import QuestionsAudienceTabs from "./QuestionsSettingsTabs";
import QuestionsView from "./QuestionsView";
import SettingsView from "./SettingsView";
import SurveyMenuBar from "./SurveyMenuBar";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";
import { TProduct } from "@formbricks/types/product";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TActionClass } from "@formbricks/types/actionClasses";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import LanguageSwitch from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/LanguageSwitch";
import { translateSurvey } from "@formbricks/lib/utils/i18n";
import { TMembershipRole } from "@formbricks/types/memberships";

interface SurveyEditorProps {
  survey: TSurvey;
  product: TProduct;
  environment: TEnvironment;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  responseCount: number;
  membershipRole?: TMembershipRole;
}

export default function SurveyEditor({
  survey,
  product,
  environment,
  actionClasses,
  attributeClasses,
  responseCount,
  membershipRole,
}: SurveyEditorProps): JSX.Element {
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>();
  const [invalidQuestions, setInvalidQuestions] = useState<String[] | null>(null);
  const [i18n, setI18n] = useState(false);
  const [languages, setLanguages] = useState(product.languages);
  const allLanguages = Object.entries(product.languages);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  useEffect(() => {
    if (survey) {
      setLocalSurvey(JSON.parse(JSON.stringify(survey)));

      if (survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [survey]);

  const translatedSurvey = useMemo(() => {
    if (localSurvey) {
      return translateSurvey(localSurvey, Object.keys(languages));
    }
  }, [i18n, localSurvey, selectedLanguage, languages]);

  // when the survey type changes, we need to reset the active question id to the first question
  useEffect(() => {
    if (localSurvey?.questions?.length && localSurvey.questions.length > 0) {
      setActiveQuestionId(localSurvey.questions[0].id);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey?.type]);

  useEffect(() => {
    if (!Object.entries(languages).some((lang) => lang[0] !== selectedLanguage)) {
      setSelectedLanguage("en");
    }
  }, [languages]);

  if (!localSurvey) {
    return <ErrorComponent />;
  }

  return (
    <>
      {console.log(translatedSurvey)}
      <div className="flex h-full flex-col">
        <SurveyMenuBar
          setLocalSurvey={setLocalSurvey}
          localSurvey={translatedSurvey ? translatedSurvey : localSurvey}
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
            <div>
              <LanguageSwitch allLanguages={allLanguages} setLanguages={setLanguages} setI18n={setI18n} />
            </div>
            {activeView === "questions" ? (
              <QuestionsView
                localSurvey={translatedSurvey ? translatedSurvey : localSurvey}
                setLocalSurvey={setLocalSurvey}
                activeQuestionId={activeQuestionId}
                setActiveQuestionId={setActiveQuestionId}
                product={product}
                invalidQuestions={invalidQuestions}
                setInvalidQuestions={setInvalidQuestions}
                selectedLanguage={selectedLanguage ? selectedLanguage : "en"}
                setSelectedLanguage={setSelectedLanguage}
                languages={Object.entries(languages)}
              />
            ) : (
              <SettingsView
                environment={environment}
                localSurvey={i18n && translatedSurvey ? translatedSurvey : localSurvey}
                setLocalSurvey={setLocalSurvey}
                actionClasses={actionClasses}
                attributeClasses={attributeClasses}
                responseCount={responseCount}
                membershipRole={membershipRole}
              />
            )}
          </main>
          <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 py-6  md:flex md:flex-col">
            <PreviewSurvey
              survey={translatedSurvey ? translatedSurvey : localSurvey}
              setActiveQuestionId={setActiveQuestionId}
              activeQuestionId={activeQuestionId}
              product={product}
              environment={environment}
              previewType={localSurvey.type === "web" ? "modal" : "fullwidth"}
              language={selectedLanguage}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
