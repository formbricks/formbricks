"use client";

import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { LoadingSkeleton } from "@/modules/survey/editor/components/loading-skeleton";
import { QuestionsView } from "@/modules/survey/editor/components/questions-view";
import { SettingsView } from "@/modules/survey/editor/components/settings-view";
import { StylingView } from "@/modules/survey/editor/components/styling-view";
import { SurveyEditorTabs } from "@/modules/survey/editor/components/survey-editor-tabs";
import { SurveyMenuBar } from "@/modules/survey/editor/components/survey-menu-bar";
import { FollowUpsView } from "@/modules/survey/follow-ups/components/follow-ups-view";
import { PreviewSurvey } from "@/modules/ui/components/preview-survey";
import { ActionClass, Environment, Language, OrganizationRole, Project } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractLanguageCodes, getEnabledLanguages } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { useDocumentVisibility } from "@formbricks/lib/useDocumentVisibility";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyEditorTabs, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { refetchProjectAction } from "../actions";

interface SurveyEditorProps {
  survey: TSurvey;
  project: Project;
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  actionClasses: ActionClass[];
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: OrganizationRole;
  colors: string[];
  isUserTargetingAllowed?: boolean;
  isMultiLanguageAllowed?: boolean;
  isSpamProtectionAllowed?: boolean;
  isFormbricksCloud: boolean;
  isUnsplashConfigured: boolean;
  plan: TOrganizationBillingPlan;
  isCxMode: boolean;
  locale: TUserLocale;
  projectPermission: TTeamPermission | null;
  mailFrom: string;
  projectLanguages: Language[];
  isSurveyFollowUpsAllowed: boolean;
  userEmail: string;
}

export const SurveyEditor = ({
  survey,
  project,
  projectLanguages,
  environment,
  actionClasses,
  contactAttributeKeys,
  segments,
  responseCount,
  membershipRole,
  colors,
  isMultiLanguageAllowed,
  isUserTargetingAllowed = false,
  isSpamProtectionAllowed = false,
  isFormbricksCloud,
  isUnsplashConfigured,
  plan,
  isCxMode = false,
  locale,
  projectPermission,
  mailFrom,
  isSurveyFollowUpsAllowed = false,
  userEmail,
}: SurveyEditorProps) => {
  const [activeView, setActiveView] = useState<TSurveyEditorTabs>("questions");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>(() => structuredClone(survey));
  const [invalidQuestions, setInvalidQuestions] = useState<string[] | null>(null);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>("default");
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
        setSelectedLanguageCode={setSelectedLanguageCode}
        isCxMode={isCxMode}
        locale={locale}
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
              projectLanguages={projectLanguages}
              invalidQuestions={invalidQuestions}
              setInvalidQuestions={setInvalidQuestions}
              selectedLanguageCode={selectedLanguageCode ? selectedLanguageCode : "default"}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isMultiLanguageAllowed={isMultiLanguageAllowed}
              isFormbricksCloud={isFormbricksCloud}
              plan={plan}
              isCxMode={isCxMode}
              locale={locale}
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

          {activeView === "settings" && (
            <SettingsView
              environment={environment}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              actionClasses={actionClasses}
              contactAttributeKeys={contactAttributeKeys}
              segments={segments}
              responseCount={responseCount}
              membershipRole={membershipRole}
              isUserTargetingAllowed={isUserTargetingAllowed}
              isSpamProtectionAllowed={isSpamProtectionAllowed}
              projectPermission={projectPermission}
              isFormbricksCloud={isFormbricksCloud}
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
              locale={locale}
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
