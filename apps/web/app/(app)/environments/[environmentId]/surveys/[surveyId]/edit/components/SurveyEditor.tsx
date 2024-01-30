"use client";

import { refetchProduct } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import Loading from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/loading";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createUserSegmentAction } from "@formbricks/ee/advancedUserTargeting/lib/actions";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { TUserSegment } from "@formbricks/types/userSegment";

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
  userSegments: TUserSegment[];
  responseCount: number;
  membershipRole?: TMembershipRole;
  colours: string[];
  isUserTargetingAllowed?: boolean;
}

export default function SurveyEditor({
  survey,
  product,
  environment,
  actionClasses,
  attributeClasses,
  userSegments,
  responseCount,
  membershipRole,
  colours,
  isUserTargetingAllowed = false,
}: SurveyEditorProps): JSX.Element {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"questions" | "settings">("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>();
  const [invalidQuestions, setInvalidQuestions] = useState<String[] | null>(null);
  const [localProduct, setLocalProduct] = useState<TProduct>(product);

  useEffect(() => {
    if (survey) {
      if (localSurvey) return;

      const surveyClone = structuredClone(survey);
      setLocalSurvey(surveyClone);

      if (survey.questions.length > 0) {
        setActiveQuestionId(survey.questions[0].id);
      }
    }
  }, [localSurvey, survey]);

  useEffect(() => {
    const listener = () => {
      if (document.visibilityState === "visible") {
        const fetchLatestProduct = async () => {
          const latestProduct = await refetchProduct(localProduct.id);
          if (latestProduct) {
            setLocalProduct(latestProduct);
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
    // if the localSurvey object has not been populated yet, do nothing
    if (!localSurvey) {
      return;
    }

    // do nothing if user targeting is not allowed
    if (!isUserTargetingAllowed) {
      return;
    }

    // do nothing if its not an in-app survey
    if (localSurvey.type !== "web") {
      return;
    }

    const createSegment = async () => {
      const createdSegment = await createUserSegmentAction({
        title: "",
        description: "",
        environmentId: environment.id,
        surveyId: localSurvey.id,
        filters: [],
        isPrivate: true,
      });

      setLocalSurvey({
        ...localSurvey,
        userSegment: createdSegment,
      });
    };

    // console.log("localSurvey.userSegment?.id", localSurvey.userSegment?.id);
    if (!localSurvey.userSegment?.id) {
      try {
        createSegment();
      } catch (err) {
        throw new Error("Error creating segment");
      }
    }
  }, [environment.id, isUserTargetingAllowed, localSurvey, router]);

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
          product={localProduct}
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
                product={localProduct}
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
                userSegments={userSegments}
                responseCount={responseCount}
                membershipRole={membershipRole}
                colours={colours}
                isUserTargetingAllowed={isUserTargetingAllowed}
              />
            )}
          </main>
          <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 py-6  md:flex md:flex-col">
            <PreviewSurvey
              survey={localSurvey}
              setActiveQuestionId={setActiveQuestionId}
              activeQuestionId={activeQuestionId}
              product={localProduct}
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
