"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractLanguageCodes, getEnabledLanguages } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { useDocumentVisibility } from "@formbricks/lib/useDocumentVisibility";
import { TActionClass } from "@formbricks/types/action-classes";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TProduct } from "@formbricks/types/product";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyEditorTabs, TSurveyStyling } from "@formbricks/types/surveys/types";
import { PreviewSurvey } from "@formbricks/ui/PreviewSurvey";
import { refetchProductAction } from "../actions";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { QuestionsAudienceTabs } from "./QuestionsStylingSettingsTabs";
import { QuestionsView } from "./QuestionsView";
import { SettingsView } from "./SettingsView";
import { StylingView } from "./StylingView";
import { SurveyMenuBar } from "./SurveyMenuBar";

interface SurveyEditorProps {
  survey: TSurvey;
  product: TProduct;
  environment: TEnvironment;
  organizationId: string;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: TMembershipRole;
  colors: string[];
  isUserTargetingAllowed?: boolean;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
  isUnsplashConfigured: boolean;
  plan: TOrganizationBillingPlan;
}

export const SurveyEditor = ({
  survey,
  product,
  environment,
  organizationId,
  actionClasses,
  attributeClasses,
  segments,
  responseCount,
  membershipRole,
  colors,
  isMultiLanguageAllowed,
  isUserTargetingAllowed = false,
  isFormbricksCloud,
  isUnsplashConfigured,
  plan,
}: SurveyEditorProps) => {
  const [activeView, setActiveView] = useState<TSurveyEditorTabs>("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>(() => structuredClone(survey));
  const [invalidQuestions, setInvalidQuestions] = useState<string[] | null>(null);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>("default");
  const surveyEditorRef = useRef(null);
  const [localProduct, setLocalProduct] = useState<TProduct>(product);

  const [styling, setStyling] = useState(localSurvey?.styling);
  const [localStylingChanges, setLocalStylingChanges] = useState<TSurveyStyling | null>(null);

  const fetchLatestProduct = useCallback(async () => {
    const refetchProductResponse = await refetchProductAction({ productId: localProduct.id });
    if (refetchProductResponse?.data) {
      setLocalProduct(refetchProductResponse.data);
    }
  }, [localProduct.id]);

  useDocumentVisibility(fetchLatestProduct);

  useEffect(() => {
    if (survey) {
      if (localSurvey) return;

      const surveyClone = structuredClone(survey);
      setLocalSurvey(surveyClone);

      if (survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey]);

  useEffect(() => {
    const listener = () => {
      if (document.visibilityState === "visible") {
        const fetchLatestProduct = async () => {
          const refetchProductResponse = await refetchProductAction({ productId: localProduct.id });
          if (refetchProductResponse?.data) {
            setLocalProduct(refetchProductResponse.data);
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
  }, [localSurvey?.type, survey?.questions]);

  useEffect(() => {
    if (!localSurvey?.languages) return;
    const enabledLanguageCodes = extractLanguageCodes(getEnabledLanguages(localSurvey.languages ?? []));
    if (!enabledLanguageCodes.includes(selectedLanguageCode)) {
      setSelectedLanguageCode("default");
    }
  }, [localSurvey?.languages, selectedLanguageCode]);

  if (!localSurvey) {
    return <LoadingSkeleton />;
  }

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <SurveyMenuBar
          setLocalSurvey={setLocalSurvey}
          localSurvey={localSurvey}
          survey={survey}
          environment={environment}
          activeId={activeView}
          setActiveId={setActiveView}
          setInvalidQuestions={setInvalidQuestions}
          product={localProduct}
          responseCount={responseCount}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
        />
        <div className="relative z-0 flex flex-1 overflow-hidden">
          <main
            className="relative z-0 w-1/2 flex-1 overflow-y-auto bg-slate-50 focus:outline-none"
            ref={surveyEditorRef}>
            <QuestionsAudienceTabs
              activeId={activeView}
              setActiveId={setActiveView}
              isStylingTabVisible={!!product.styling.allowStyleOverwrite}
            />

            {activeView === "questions" && (
              <QuestionsView
                localSurvey={localSurvey}
                setLocalSurvey={setLocalSurvey}
                activeQuestionId={activeQuestionId}
                setActiveQuestionId={setActiveQuestionId}
                product={localProduct}
                invalidQuestions={invalidQuestions}
                setInvalidQuestions={setInvalidQuestions}
                selectedLanguageCode={selectedLanguageCode ? selectedLanguageCode : "default"}
                setSelectedLanguageCode={setSelectedLanguageCode}
                isMultiLanguageAllowed={isMultiLanguageAllowed}
                isFormbricksCloud={isFormbricksCloud}
                attributeClasses={attributeClasses}
                plan={plan}
              />
            )}

            {activeView === "styling" && product.styling.allowStyleOverwrite && (
              <StylingView
                colors={colors}
                environment={environment}
                localSurvey={localSurvey}
                setLocalSurvey={setLocalSurvey}
                product={localProduct}
                styling={styling ?? null}
                setStyling={setStyling}
                localStylingChanges={localStylingChanges}
                setLocalStylingChanges={setLocalStylingChanges}
                isUnsplashConfigured={isUnsplashConfigured}
              />
            )}

            {activeView === "settings" && (
              <SettingsView
                environment={environment}
                organizationId={organizationId}
                localSurvey={localSurvey}
                setLocalSurvey={setLocalSurvey}
                actionClasses={actionClasses}
                attributeClasses={attributeClasses}
                segments={segments}
                responseCount={responseCount}
                membershipRole={membershipRole}
                isUserTargetingAllowed={isUserTargetingAllowed}
                isFormbricksCloud={isFormbricksCloud}
                product={localProduct}
              />
            )}
          </main>

          <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-200 bg-slate-100 py-6 shadow-inner md:flex md:flex-col">
            <PreviewSurvey
              survey={localSurvey}
              questionId={activeQuestionId}
              product={localProduct}
              environment={environment}
              previewType={
                localSurvey.type === "app" || localSurvey.type === "website" ? "modal" : "fullwidth"
              }
              languageCode={selectedLanguageCode}
              onFileUpload={async (file) => file.name}
            />
          </aside>
        </div>
      </div>
    </>
  );
};
