"use client";

import { LoadingSkeleton } from "@/modules/survey/editor/components/loading-skeleton";
import { QuestionsView } from "@/modules/survey/editor/components/questions-view";
import { SettingsView } from "@/modules/survey/editor/components/settings-view";
import { StylingView } from "@/modules/survey/editor/components/styling-view";
import { SurveyEditorTabs } from "@/modules/survey/editor/components/survey-editor-tabs";
import { SurveyMenuBar } from "@/modules/survey/editor/components/survey-menu-bar";
import { FollowUpsView } from "@/modules/survey/follow-ups/components/follow-ups-view";
import { PreviewSurvey } from "@/modules/ui/components/preview-survey";
import { ActionClass, Environment, OrganizationRole, Project } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { useDocumentVisibility } from "@formbricks/lib/useDocumentVisibility";
import { TSurvey, TSurveyEditorTabs, TSurveyStyling } from "@formbricks/types/surveys/types";
import { refetchProjectAction } from "../actions";
import { IntroView } from "./intro-view";
import { RewardsView } from "./rewards-view";

interface SurveyEditorProps {
  survey: TSurvey;
  project: Project;
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  actionClasses: ActionClass[];
  responseCount: number;
  membershipRole?: OrganizationRole;
  colors: string[];
  isUnsplashConfigured: boolean;
  isCxMode: boolean;
  mailFrom: string;
  isSurveyFollowUpsAllowed: boolean;
  userEmail: string;
}

export const SurveyEditor = ({
  survey,
  project,
  environment,
  actionClasses,
  responseCount,
  membershipRole,
  colors,
  isUnsplashConfigured,
  isCxMode = false,
  mailFrom,
  isSurveyFollowUpsAllowed = false,
  userEmail,
}: SurveyEditorProps) => {
  const [activeView, setActiveView] = useState<TSurveyEditorTabs>("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>(() => structuredClone(survey));
  const [invalidQuestions, setInvalidQuestions] = useState<string[] | null>(null);
  const [selectedLanguageCode] = useState<string>("default");
  const surveyEditorRef = useRef(null);
  const [localProject, setLocalProject] = useState<Project>(project);

  const [styling, setStyling] = useState(localSurvey?.styling);
  const [localStylingChanges, setLocalStylingChanges] = useState<TSurveyStyling | null>(null);

  const fetchLatestProject = useCallback(async () => {
    const refetchProjectResponse = await refetchProjectAction({ projectId: localProject.id });
    if (refetchProjectResponse?.data) {
      setLocalProject(refetchProjectResponse.data);
    }
  }, [localProject.id]);

  useDocumentVisibility(fetchLatestProject);

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
        const fetchLatestProject = async () => {
          const refetchProjectResponse = await refetchProjectAction({ projectId: localProject.id });
          if (refetchProjectResponse?.data) {
            setLocalProject(refetchProjectResponse.data);
          }
        };
        fetchLatestProject();
      }
    };
    document.addEventListener("visibilitychange", listener);
    return () => {
      document.removeEventListener("visibilitychange", listener);
    };
  }, [localProject.id]);

  // when the survey type changes, we need to reset the active question id to the first question
  useEffect(() => {
    if (localSurvey?.questions?.length && localSurvey.questions.length > 0) {
      setActiveQuestionId(localSurvey.questions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey?.type, survey?.questions]);

  if (!localSurvey) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <SurveyMenuBar
        setLocalSurvey={setLocalSurvey}
        localSurvey={localSurvey}
        survey={survey}
        environmentId={environment.id}
        activeId={activeView}
        setActiveId={setActiveView}
        setInvalidQuestions={setInvalidQuestions}
        project={localProject}
        responseCount={responseCount}
        selectedLanguageCode={selectedLanguageCode}
        isCxMode={isCxMode}
      />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main
          className="relative z-0 w-1/2 flex-1 overflow-y-auto bg-slate-50 focus:outline-none"
          ref={surveyEditorRef}>
          <SurveyEditorTabs
            activeId={activeView}
            setActiveId={setActiveView}
            isCxMode={isCxMode}
            isStylingTabVisible={!!project.styling.allowStyleOverwrite}
            isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
          />

          {activeView === "questions" && (
            <QuestionsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              activeQuestionId={activeQuestionId}
              setActiveQuestionId={setActiveQuestionId}
              project={localProject}
              invalidQuestions={invalidQuestions}
              setInvalidQuestions={setInvalidQuestions}
              selectedLanguageCode={selectedLanguageCode ? selectedLanguageCode : "default"}
              isCxMode={isCxMode}
            />
          )}

          {activeView === "styling" && project.styling.allowStyleOverwrite && (
            <StylingView
              colors={colors}
              environmentId={environment.id}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              project={localProject}
              styling={styling ?? null}
              setStyling={setStyling}
              localStylingChanges={localStylingChanges}
              setLocalStylingChanges={setLocalStylingChanges}
              isUnsplashConfigured={isUnsplashConfigured}
              isCxMode={isCxMode}
            />
          )}

          {activeView === "rewards" && project.styling.allowStyleOverwrite && (
            <RewardsView localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} isCxMode={isCxMode} />
          )}

          {activeView === "intro" && <IntroView localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />}

          {activeView === "settings" && (
            <SettingsView
              environment={environment}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              actionClasses={actionClasses}
              responseCount={responseCount}
              membershipRole={membershipRole}
            />
          )}

          {activeView === "followUps" && (
            <FollowUpsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              selectedLanguageCode={selectedLanguageCode}
              mailFrom={mailFrom}
              isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
              userEmail={userEmail}
            />
          )}
        </main>

        <aside className="group hidden flex-1 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-200 bg-slate-100 shadow-inner md:flex md:flex-col">
          <PreviewSurvey
            survey={localSurvey}
            questionId={activeQuestionId}
            project={localProject}
            environment={environment}
            previewType={localSurvey.type === "app" ? "modal" : "fullwidth"}
            languageCode={selectedLanguageCode}
          />
        </aside>
      </div>
    </div>
  );
};
