"use client";

import { refetchProduct } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import Loading from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/loading";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

import LanguageSwitch from "@formbricks/ee/multiLanguage/components/LanguageSwitch";
import { translateSurvey } from "@formbricks/ee/multiLanguage/utils/i18n";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TLanguages, TProduct } from "@formbricks/types/product";
import { TI18nString, TSurvey } from "@formbricks/types/surveys";

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
  isEnterpriseEdition: boolean;
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
  isEnterpriseEdition,
  colours,
}: SurveyEditorProps): JSX.Element {
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>();
  const [invalidQuestions, setInvalidQuestions] = useState<String[] | null>(null);
  const [i18n, setI18n] = useState(false);
  const [languages, setLanguages] = useState<TLanguages>({ en: "English" });
  const [allLanguages, setAllLanguages] = useState(Object.entries(product.languages ?? { en: "English" }));
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const surveyEditorRef = useRef(null);

  const [localProduct, setLocalProduct] = useState<TProduct>(product);
  useEffect(() => {
    if (survey) {
      if (localSurvey) return;
      setLocalSurvey(JSON.parse(JSON.stringify(survey)));
      if (survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
      if ((survey.questions[0].headline as TI18nString)._i18n_) {
        // Construct an object with the language codes from the headline
        const languagesObj: TLanguages = Object.keys(survey.questions[0].headline)
          .filter((key) => key !== "_i18n_") // Exclude the _i18n_ property
          .reduce((acc, lang) => {
            acc[lang] = product.languages[lang];
            return acc;
          }, {});

        setLanguages(languagesObj);
      }
    }
  }, [survey, localSurvey]);

  const translatedSurvey = useMemo(() => {
    if (!localSurvey || localSurvey.questions.length === 0) return;
    if (localSurvey) {
      return translateSurvey(localSurvey, Object.keys(languages));
    }
  }, [i18n, localSurvey?.id, localSurvey?.questions.length, selectedLanguage, languages]);
  useEffect(() => {
    const listener = () => {
      if (document.visibilityState === "visible") {
        const fetchLatestProduct = async () => {
          const latestProduct = await refetchProduct(localProduct.id);
          if (latestProduct) {
            setLocalProduct(latestProduct);
            setAllLanguages(Object.entries(latestProduct.languages));
          }
        };
        fetchLatestProduct();
      }
    };
    document.addEventListener("visibilitychange", listener);
    return () => {
      document.removeEventListener("visibilitychange", listener);
    };
  }, [localProduct.id]);

  // when the survey type changes, we need to reset the active question id to the first question
  useEffect(() => {
    if (localSurvey?.questions?.length && localSurvey.questions.length > 0) {
      setActiveQuestionId(localSurvey.questions[0].id);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey?.type]);

  useEffect(() => {
    if (!Object.keys(languages).includes(selectedLanguage)) {
      setSelectedLanguage("en");
    }
  }, [languages]);

  if (!localSurvey) {
    return <Loading />;
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <SurveyMenuBar
          setLocalSurvey={setLocalSurvey}
          localSurvey={translatedSurvey ? translatedSurvey : localSurvey}
          survey={survey}
          environment={environment}
          activeId={activeView}
          setActiveId={setActiveView}
          setInvalidQuestions={setInvalidQuestions}
          product={localProduct}
          responseCount={responseCount}
          languages={Object.keys(languages)}
          selectedLanguage={selectedLanguage}
        />
        <div className="relative z-0 flex flex-1 overflow-hidden">
          <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none" ref={surveyEditorRef}>
            <QuestionsAudienceTabs activeId={activeView} setActiveId={setActiveView} />

            {activeView === "questions" ? (
              <>
                <div className="mt-16">
                  <LanguageSwitch
                    allLanguages={allLanguages}
                    languages={languages}
                    setLanguages={setLanguages}
                    i18n={i18n}
                    setI18n={setI18n}
                    environmentId={environment.id}
                    isEnterpriseEdition={isEnterpriseEdition}
                  />
                </div>
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
              </>
            ) : (
              <SettingsView
                environment={environment}
                localSurvey={i18n && translatedSurvey ? translatedSurvey : localSurvey}
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
              survey={translatedSurvey ? translatedSurvey : localSurvey}
              setActiveQuestionId={setActiveQuestionId}
              activeQuestionId={activeQuestionId}
              product={localProduct}
              environment={environment}
              previewType={localSurvey.type === "web" ? "modal" : "fullwidth"}
              language={selectedLanguage}
              onFileUpload={async (file) => file.name}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
