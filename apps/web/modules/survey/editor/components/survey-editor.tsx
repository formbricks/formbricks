"use client";

import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActionClass, Language, OrganizationRole } from "@formbricks/database/prisma-browser";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSegment } from "@formbricks/types/segment";
import {
  TSurvey,
  TSurveyEditorTabs,
  TSurveyStyling,
  TSurveyVisibility,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { extractLanguageCodes, getEnabledLanguages } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { type TStylingAppearance } from "@/lib/styling/dark-mode";
import type { TSurveyAccess } from "@/lib/survey/visibility/access";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDocumentVisibility } from "@/lib/useDocumentVisibility";
import { useCustomCssValidation } from "@/modules/custom-css/components/hooks/use-custom-css-validation";
import { useLiveWorkspaceCustomCss } from "@/modules/custom-css/components/hooks/use-live-workspace-custom-css";
import { getCustomCssSource, toCustomCssDraft } from "@/modules/custom-css/components/lib/draft";
import { type TSurveyCustomCssEditorConfig } from "@/modules/custom-css/components/types";
import { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { ElementsView } from "@/modules/survey/editor/components/elements-view";
import { LoadingSkeleton } from "@/modules/survey/editor/components/loading-skeleton";
import { SettingsView } from "@/modules/survey/editor/components/settings-view";
import { StylingView } from "@/modules/survey/editor/components/styling-view";
import { SurveyEditorTabs } from "@/modules/survey/editor/components/survey-editor-tabs";
import { SurveyMenuBar } from "@/modules/survey/editor/components/survey-menu-bar";
import { type TEditorWorkspace } from "@/modules/survey/editor/lib/workspace";
import { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import { FollowUpsView } from "@/modules/survey/follow-ups/components/follow-ups-view";
import { shouldShowFollowUpsTab } from "@/modules/survey/follow-ups/lib/deprecation";
import { LanguageView } from "@/modules/survey/multi-language-surveys/components/language-view";
import { type TSurveySchedulingConfig } from "@/modules/survey/scheduling/lib/config";
import { RestrictedSurveyBanner } from "@/modules/survey/visibility/components/restricted-survey-banner";
import { showRestrictedBanner } from "@/modules/survey/visibility/lib/markers";
import {
  type TSurveyVisibilityUiGate,
  isOutboundBlocked,
  withoutVisibilityControls,
} from "@/modules/survey/visibility/lib/state";
import { PreviewSurvey } from "@/modules/ui/components/preview-survey";
import { getWorkspaceLanguagesAction, refetchWorkspaceAction } from "../actions";

// How long the preview trails the editor. Every preview render re-mounts the whole survey bundle, so
// following each keystroke made typing lag on large surveys (ENG-991).
const PREVIEW_DEBOUNCE_MS = 300;
// Memoized so the editor's per-keystroke re-renders skip the preview while its debounced inputs are
// unchanged; without it the preview would still re-render (and re-mount the survey) every time.
const MemoizedPreviewSurvey = memo(PreviewSurvey);

interface SurveyEditorProps {
  survey: TSurvey;
  workspace: TEditorWorkspace;
  actionClasses: ActionClass[];
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
  responseCount: number;
  finishedResponseCount: number;
  membershipRole?: OrganizationRole;
  colors: string[];
  isUserTargetingAllowed?: boolean;
  isSpamProtectionAllowed?: boolean;
  isFormbricksCloud: boolean;
  isUnsplashConfigured: boolean;
  isQuotasAllowed: boolean;
  isCxMode: boolean;
  surveySchedulingConfig: TSurveySchedulingConfig;
  locale: TUserLocale;
  workspacePermission: TTeamPermission | null;
  mailFrom: string;
  workspaceLanguages: Language[];
  isSurveyFollowUpsAllowed: boolean;
  isWorkflowsAllowed: boolean;
  userEmail: string;
  teamMemberDetails: TFollowUpEmailToUser[];
  isStorageConfigured: boolean;
  quotas: TSurveyQuota[];
  isExternalUrlsAllowed: boolean;
  publicDomain: string;
  enterpriseLicenseRequestFormUrl: string;
  surveyVisibilityGate: TSurveyVisibilityUiGate;
  /** The effective visibility (a change in flight counts as restricted), not the stored flag. */
  visibility: TSurveyVisibility;
  surveyAccess: TSurveyAccess | null;
  ownerName: string | null;
  /** `null` when the Custom CSS rollout is off for this organization, which hides the card. */
  customCssEditor?: TSurveyCustomCssEditorConfig | null;
}

export const SurveyEditor = ({
  survey,
  workspace,
  workspaceLanguages,
  actionClasses,
  contactAttributeKeys,
  segments,
  responseCount,
  finishedResponseCount,
  membershipRole,
  colors,
  isUserTargetingAllowed = false,
  isSpamProtectionAllowed = false,
  isFormbricksCloud,
  isUnsplashConfigured,
  isQuotasAllowed,
  isCxMode = false,
  surveySchedulingConfig,
  locale,
  workspacePermission,
  mailFrom,
  isSurveyFollowUpsAllowed = false,
  isWorkflowsAllowed = false,
  userEmail,
  teamMemberDetails,
  isStorageConfigured,
  quotas,
  isExternalUrlsAllowed,
  publicDomain,
  enterpriseLicenseRequestFormUrl,
  surveyVisibilityGate,
  visibility,
  surveyAccess,
  ownerName,
  customCssEditor = null,
}: Readonly<SurveyEditorProps>) => {
  const isFollowUpsTabVisible = shouldShowFollowUpsTab({
    followUpCount: survey.followUps.length,
    isSurveyFollowUpsAllowed,
    isWorkflowsAllowed,
  });

  const [activeView, setActiveView] = useState<TSurveyEditorTabs>("elements");
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  // `localSurvey` must stay a structural clone of `survey`: the menu bar compares the two with
  // `isDeepEqual` to gate the draft auto-save, the back-navigation dialog and the beforeunload
  // prompt, and that comparison short-circuits on differing key counts. The inlined
  // `embeddedFields` is the editor's Embedded Data state (ENG-2628) — the Variables and Hidden
  // Fields cards edit it and every editor surface reads it — so it must arrive here exactly as the
  // server sent it and be sent back the same way, which is also what keeps that comparison honest.
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>(() => structuredClone(survey));
  // Only the preview trails; the editor panes keep reading `localSurvey` so input stays immediate.
  const debouncedPreviewSurvey = useDebouncedValue(localSurvey, PREVIEW_DEBOUNCE_MS);
  const [invalidElements, setInvalidElements] = useState<string[] | null>(null);
  const [hasIncompleteTranslations, setHasIncompleteTranslations] = useState(false);
  // Set when a save or publish is blocked by a missing trigger, so the Survey Trigger card can say
  // so (ENG-2581). The card itself stops showing the error once the survey has a trigger.
  const [hasTriggerError, setHasTriggerError] = useState(false);

  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>("default");

  // ENG-3395. Visibility is changed through its own endpoint, never by a survey save, and the server
  // decides together what is now enforced and why this user can see the survey. So after a change the
  // route is refreshed and the banner, the Follow-ups tab and the menu bar all render from the one
  // server answer (effective visibility, pending value, access), instead of patching one of them
  // locally. The refresh leaves `localSurvey` alone, and the dirty check ignores the visibility
  // columns (`unsaved-changes.ts`), so it never makes the editor look dirty.
  const router = useRouter();
  const [isVisibilityTurnedOff, setIsVisibilityTurnedOff] = useState(false);
  // `visibility_not_enabled` takes the controls away at once; what is still enforced comes back from
  // the refresh, so the banner and the Follow-ups notice follow the server rather than this answer.
  const visibilityGate = isVisibilityTurnedOff
    ? withoutVisibilityControls(surveyVisibilityGate)
    : surveyVisibilityGate;
  const handleVisibilityChanged = useCallback(() => router.refresh(), [router]);
  // Stable: the Collaborate modal runs it from an effect.
  const handleVisibilityNotEnabled = useCallback(() => {
    setIsVisibilityTurnedOff(true);
    router.refresh();
  }, [router]);

  // `isFollowUpsTabVisible` tracks the server `survey` prop, which a save refreshes
  // (`survey-menu-bar` calls `router.refresh()`). Deleting the last follow-up therefore hides the
  // tab while `activeView` — client state — still points at it, leaving an empty main pane with no
  // tab selected. Fall back to the elements view so the deletion flow cannot dead-end.
  useEffect(() => {
    if (!isFollowUpsTabVisible && activeView === "followUps") {
      setActiveView("elements");
    }
  }, [isFollowUpsTabVisible, activeView]);
  const surveyEditorRef = useRef(null);
  const [localWorkspace, setLocalWorkspace] = useState<TEditorWorkspace>(workspace);
  const [localWorkspaceLanguages, setLocalWorkspaceLanguages] = useState<Language[]>(workspaceLanguages);

  const [styling, setStyling] = useState<TSurveyStyling | null>(localSurvey?.styling ?? null);
  const [localStylingChanges, setLocalStylingChanges] = useState<TSurveyStyling | null>(null);
  // Light / Dark selector of the Styling tab (D14). The preview follows it while that tab is open.
  const [stylingAppearance, setStylingAppearance] = useState<TStylingAppearance>("light");

  // Survey Custom CSS is checked here rather than in the Styling tab because the preview needs its
  // output on every tab: the preview only ever renders CSS the server validated for the current draft
  // (ENG-3553). Workspace CSS is inherited whether or not the survey overrides the theme (D16).
  const surveyCustomCssValidation = useCustomCssValidation({
    workspaceId: workspace.id,
    scope: "survey",
    surveyId: survey.id,
    draft: toCustomCssDraft(getCustomCssSource(localSurvey?.customCss)),
    enabled: customCssEditor !== null,
  });
  // Workspace CSS saved in another tab reaches the preview and the inherited panel without a reload.
  const liveWorkspaceCss = useLiveWorkspaceCustomCss({
    workspaceId: workspace.id,
    enabled: customCssEditor !== null,
    initial: {
      source: customCssEditor?.workspace.source ?? null,
      compiled: customCssEditor?.workspace.compiled ?? null,
    },
  });
  const workspaceCompiledCss = liveWorkspaceCss.compiled;
  const liveCustomCssEditor = useMemo(
    () =>
      customCssEditor
        ? {
            ...customCssEditor,
            workspace: {
              ...customCssEditor.workspace,
              source: liveWorkspaceCss.source,
              compiled: workspaceCompiledCss,
            },
          }
        : null,
    [customCssEditor, liveWorkspaceCss.source, workspaceCompiledCss]
  );
  const surveyPreviewCss = surveyCustomCssValidation.previewCss;
  // Stable, so the memoized preview re-mounts the survey only when the validated CSS changes.
  const previewCustomCss = useMemo(
    () => (customCssEditor ? { workspace: workspaceCompiledCss, survey: surveyPreviewCss } : undefined),
    [customCssEditor, workspaceCompiledCss, surveyPreviewCss]
  );

  const fetchLatestWorkspaceData = useCallback(async () => {
    const [refetchWorkspaceResponse, refetchLanguagesResponse] = await Promise.all([
      refetchWorkspaceAction({ workspaceId: localWorkspace.id }),
      getWorkspaceLanguagesAction({ workspaceId: localWorkspace.id }),
    ]);

    if (refetchWorkspaceResponse?.data) {
      setLocalWorkspace(refetchWorkspaceResponse.data);
    }

    if (refetchLanguagesResponse?.data) {
      setLocalWorkspaceLanguages(refetchLanguagesResponse.data);
    }
  }, [localWorkspace.id]);

  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);

  useDocumentVisibility(fetchLatestWorkspaceData);

  // Recovery only: `localSurvey` is seeded from `survey` in its `useState` initializer, so this is a
  // no-op unless something ever resets it to null (the `LoadingSkeleton` guard below is the state it
  // recovers from). Written as an updater rather than reading `localSurvey`, because depending on it
  // would re-run this on every keystroke in the editor to do nothing — and that shape becomes a real
  // loop the moment someone edits the guard. The active element is not set here: the
  // `[localSurvey?.type]` effect below already picks the first element whenever `localSurvey`
  // appears.
  useEffect(() => {
    // Must stay identical to the `useState` initializer above: the working copy is compared
    // against `survey` key-for-key by the menu bar, so any reshaping has to apply to both or neither.
    setLocalSurvey((current) => current ?? structuredClone(survey));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally resets active element only when the survey type changes, not on every block edit
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
  const previewSurvey = debouncedPreviewSurvey ?? localSurvey;

  return (
    <div className="flex h-full w-full flex-col">
      <SurveyMenuBar
        setLocalSurvey={setLocalSurveyNonNull}
        localSurvey={localSurvey}
        survey={survey}
        activeId={activeView}
        setActiveId={setActiveView}
        setInvalidElements={setInvalidElements}
        setHasTriggerError={setHasTriggerError}
        workspace={localWorkspace}
        responseCount={responseCount}
        finishedResponseCount={finishedResponseCount}
        selectedLanguageCode={selectedLanguageCode}
        isCxMode={isCxMode}
        locale={locale}
        setIsCautionDialogOpen={setIsCautionDialogOpen}
        isStorageConfigured={isStorageConfigured}
        visibilityGate={visibilityGate}
        effectiveVisibility={visibility}
        onVisibilityChanged={handleVisibilityChanged}
        onVisibilityNotEnabled={handleVisibilityNotEnabled}
        surveyAccess={surveyAccess}
        ownerName={ownerName}
        customCssValidationStatus={surveyCustomCssValidation.status}
      />
      {showRestrictedBanner({
        enforced: visibilityGate.enforced,
        visibility,
        access: surveyAccess,
      }) && (
        // A full-width strip under the menu bar, like the bar itself.
        <RestrictedSurveyBanner ownerName={ownerName} className="rounded-none border-x-0 border-t-0 px-5" />
      )}
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main
          className="relative z-0 w-full overflow-y-auto bg-slate-50 focus:outline-hidden md:w-2/3"
          ref={surveyEditorRef}>
          <SurveyEditorTabs
            activeId={activeView}
            setActiveId={setActiveView}
            isCxMode={isCxMode}
            isStylingTabVisible={!!workspace.styling.allowStyleOverwrite}
            isFollowUpsTabVisible={isFollowUpsTabVisible}
            hasLanguageErrors={hasIncompleteTranslations}
          />

          {activeView === "elements" && (
            <ElementsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              persistedSurvey={survey}
              activeElementId={activeElementId}
              setActiveElementId={setActiveElementId}
              workspace={localWorkspace}
              invalidElements={invalidElements}
              setInvalidElements={setInvalidElements}
              selectedLanguageCode={selectedLanguageCode || "default"}
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
              appearance={stylingAppearance}
              setAppearance={setStylingAppearance}
              customCssEditor={liveCustomCssEditor}
              customCssValidation={surveyCustomCssValidation}
              savedCustomCss={survey.customCss}
            />
          )}

          {activeView === "language" && (
            <LanguageView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              workspaceLanguages={localWorkspaceLanguages}
              locale={locale}
              setHasIncompleteTranslations={setHasIncompleteTranslations}
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
              finishedResponseCount={finishedResponseCount}
              membershipRole={membershipRole}
              isUserTargetingAllowed={isUserTargetingAllowed}
              isSpamProtectionAllowed={isSpamProtectionAllowed}
              workspacePermission={workspacePermission}
              isFormbricksCloud={isFormbricksCloud}
              isQuotasAllowed={isQuotasAllowed}
              quotas={quotas}
              surveySchedulingConfig={surveySchedulingConfig}
              locale={locale}
              appSetupCompleted={localWorkspace.appSetupCompleted}
              enterpriseLicenseRequestFormUrl={enterpriseLicenseRequestFormUrl}
              hasTriggerError={hasTriggerError}
            />
          )}

          {activeView === "followUps" && isFollowUpsTabVisible && (
            <FollowUpsView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              selectedLanguageCode={selectedLanguageCode}
              mailFrom={mailFrom}
              isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
              isWorkflowsAllowed={isWorkflowsAllowed}
              workspaceId={workspace.id}
              userEmail={userEmail}
              teamMemberDetails={teamMemberDetails}
              locale={locale}
              isRestricted={isOutboundBlocked(visibilityGate.enforced, { visibility })}
              workspaceName={localWorkspace.name}
            />
          )}
        </main>

        <aside className="group hidden w-1/3 shrink-0 items-center justify-center overflow-hidden border-l border-slate-200 bg-slate-100 shadow-inner md:flex md:flex-col">
          <MemoizedPreviewSurvey
            survey={previewSurvey}
            elementId={activeElementId}
            workspace={localWorkspace}
            previewType={previewSurvey.type === "app" ? "modal" : "fullwidth"}
            languageCode={selectedLanguageCode}
            setLanguageCode={setSelectedLanguageCode}
            locale={locale}
            isSpamProtectionAllowed={isSpamProtectionAllowed}
            publicDomain={publicDomain}
            appearance={activeView === "styling" ? stylingAppearance : "light"}
            customCss={previewCustomCss}
          />
        </aside>
      </div>
      <EditPublicSurveyAlertDialog open={isCautionDialogOpen} setOpen={setIsCautionDialogOpen} />
    </div>
  );
};
