"use client";

import { ActionClass, Language, OrganizationRole, Workspace } from "@prisma/client";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyEditorTabs, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { extractLanguageCodes, getEnabledLanguages } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { useDocumentVisibility } from "@/lib/useDocumentVisibility";
import { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { ElementsView } from "@/modules/survey/editor/components/elements-view";
import { LoadingSkeleton } from "@/modules/survey/editor/components/loading-skeleton";
import { SettingsView } from "@/modules/survey/editor/components/settings-view";
import { StylingView } from "@/modules/survey/editor/components/styling-view";
import { SurveyEditorTabs } from "@/modules/survey/editor/components/survey-editor-tabs";
import { SurveyMenuBar } from "@/modules/survey/editor/components/survey-menu-bar";
import { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import { FollowUpsView } from "@/modules/survey/follow-ups/components/follow-ups-view";
import { PreviewSurvey } from "@/modules/ui/components/preview-survey";
import { refetchWorkspaceAction } from "../actions";

interface SurveyEditorProps {
  survey: TSurvey;
  workspace: Workspace;
  appSetupCompleted: boolean;
  actionClasses: ActionClass[];
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: OrganizationRole;
  colors: string[];
  isUserTargetingAllowed?: boolean;
  isSpamProtectionAllowed?: boolean;
  isFormbricksCloud: boolean;
  isUnsplashConfigured: boolean;
  isQuotasAllowed: boolean;
  isCxMode: boolean;
  locale: TUserLocale;
  workspacePermission: TTeamPermission | null;
  mailFrom: string;
  workspaceLanguages: Language[];
  isSurveyFollowUpsAllowed: boolean;
  userEmail: string;
  teamMemberDetails: TFollowUpEmailToUser[];
  isStorageConfigured: boolean;
  quotas: TSurveyQuota[];
  isExternalUrlsAllowed: boolean;
  publicDomain: string;
}

export const SurveyEditor = ({
  survey,
  workspace,
  workspaceLanguages,
  appSetupCompleted,
  actionClasses,
  contactAttributeKeys,
  segments,
  responseCount,
  membershipRole,
  colors,
  isUserTargetingAllowed = false,
  isSpamProtectionAllowed = false,
  isFormbricksCloud,
  isUnsplashConfigured,
  isQuotasAllowed,
  isCxMode = false,
  locale,
  workspacePermission,
  mailFrom,
  isSurveyFollowUpsAllowed = false,
  userEmail,
  teamMemberDetails,
  isStorageConfigured,
  quotas,
  isExternalUrlsAllowed,
  publicDomain,
}: SurveyEditorProps) => {
  const [activeView, setActiveView] = useState<TSurveyEditorTabs>("elements");
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>(() => structuredClone(survey));
  const [invalidElements, setInvalidElements] = useState<string[] | null>([]);

  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>("default");
  const surveyEditorRef = useRef(null);
  const [localWorkspace, setLocalWorkspace] = useState<Workspace>(workspace);

  const [styling, setStyling] = useState<TSurveyStyling | null>(localSurvey?.styling ?? null);
  const [localStylingChanges, setLocalStylingChanges] = useState<TSurveyStyling | null>(null);

  const fetchLatestWorkspace = useCallback(async () => {
    const refetchWorkspaceResponse = await refetchWorkspaceAction({ workspaceId: localWorkspace.id });
    if (refetchWorkspaceResponse?.data) {
      setLocalWorkspace(refetchWorkspaceResponse.data);
    }
  }, [localWorkspace.id]);

  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);

  useDocumentVisibility(fetchLatestWorkspace);

  useEffect(() => {
    if (survey) {
      if (localSurvey) return;

      const surveyClone = structuredClone(survey);
      setLocalSurvey(surveyClone);

      // Set first element from first block
      const firstBlock = survey.blocks[0];
      if (firstBlock) {
        setActiveElementId(firstBlock.elements?.[0]?.id);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey]);

  useEffect(() => {
    const listener = () => {
      if (document.visibilityState === "visible") {
        const fetchLatestWorkspace = async () => {
          const refetchWorkspaceResponse = await refetchWorkspaceAction({ workspaceId: localWorkspace.id });
          if (refetchWorkspaceResponse?.data) {
            setLocalWorkspace(refetchWorkspaceResponse.data);
          }
        };
        fetchLatestWorkspace();
      }
    };
    document.addEventListener("visibilitychange", listener);
    return () => {
      document.removeEventListener("visibilitychange", listener);
    };
  }, [localWorkspace.id]);

  // when the survey type changes, we need to reset the active element id to the first element
  useEffect(() => {
    const firstBlock = localSurvey?.blocks[0];
    if (firstBlock) {
      setActiveElementId(firstBlock.elements[0]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSurvey?.type]);

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

  // After the null guard, we can safely narrow the setter type for child components
  const setLocalSurveyNonNull = setLocalSurvey as Dispatch<SetStateAction<TSurvey>>;

  return (
    <div className="flex h-full w-full flex-col">
      <SurveyMenuBar
        setLocalSurvey={setLocalSurveyNonNull}
        localSurvey={localSurvey}
        survey={survey}
        activeId={activeView}
        setActiveId={setActiveView}
        setInvalidElements={setInvalidElements}
        workspace={localWorkspace}
        responseCount={responseCount}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        isCxMode={isCxMode}
        locale={locale}
        setIsCautionDialogOpen={setIsCautionDialogOpen}
        isStorageConfigured={isStorageConfigured}
      />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main
          className="relative z-0 w-full overflow-y-auto bg-slate-50 focus:outline-none md:w-2/3"
          ref={surveyEditorRef}>
          <SurveyEditorTabs
            activeId={activeView}
            setActiveId={setActiveView}
            isCxMode={isCxMode}
            isStylingTabVisible={!!workspace.styling.allowStyleOverwrite}
          />

          {activeView === "elements" && (
            <ElementsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              activeElementId={activeElementId}
              setActiveElementId={setActiveElementId}
              workspace={localWorkspace}
              workspaceLanguages={workspaceLanguages}
              invalidElements={invalidElements}
              setInvalidElements={setInvalidElements}
              selectedLanguageCode={selectedLanguageCode || "default"}
              setSelectedLanguageCode={setSelectedLanguageCode}
              isFormbricksCloud={isFormbricksCloud}
              isCxMode={isCxMode}
              locale={locale}
              responseCount={responseCount}
              setIsCautionDialogOpen={setIsCautionDialogOpen}
              isStorageConfigured={isStorageConfigured}
              quotas={quotas}
              isExternalUrlsAllowed={isExternalUrlsAllowed}
            />
          )}

          {activeView === "styling" && workspace.styling.allowStyleOverwrite && (
            <StylingView
              colors={colors}
              workspaceId={workspace.id}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              workspace={localWorkspace}
              styling={styling ?? null}
              setStyling={setStyling}
              localStylingChanges={localStylingChanges}
              setLocalStylingChanges={setLocalStylingChanges}
              isUnsplashConfigured={isUnsplashConfigured}
              isCxMode={isCxMode}
              isStorageConfigured={isStorageConfigured}
            />
          )}

          {activeView === "settings" && (
            <SettingsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              actionClasses={actionClasses}
              contactAttributeKeys={contactAttributeKeys}
              segments={segments}
              responseCount={responseCount}
              membershipRole={membershipRole}
              isUserTargetingAllowed={isUserTargetingAllowed}
              isSpamProtectionAllowed={isSpamProtectionAllowed}
              workspacePermission={workspacePermission}
              isFormbricksCloud={isFormbricksCloud}
              isQuotasAllowed={isQuotasAllowed}
              quotas={quotas}
              locale={locale}
            />
          )}

          {activeView === "followUps" && (
            <FollowUpsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              selectedLanguageCode={selectedLanguageCode}
              mailFrom={mailFrom}
              isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
              isFormbricksCloud={isFormbricksCloud}
              userEmail={userEmail}
              teamMemberDetails={teamMemberDetails}
              locale={locale}
            />
          )}
        </main>

        <aside className="group hidden w-1/3 flex-shrink-0 items-center justify-center overflow-hidden border-l border-slate-200 bg-slate-100 shadow-inner md:flex md:flex-col">
          <PreviewSurvey
            survey={localSurvey}
            elementId={activeElementId}
            workspace={localWorkspace}
            environment={{ appSetupCompleted }}
            previewType={localSurvey.type === "app" ? "modal" : "fullwidth"}
            languageCode={selectedLanguageCode}
            isSpamProtectionAllowed={isSpamProtectionAllowed}
            publicDomain={publicDomain}
          />
        </aside>
      </div>
      <EditPublicSurveyAlertDialog open={isCautionDialogOpen} setOpen={setIsCautionDialogOpen} />
    </div>
  );
};
