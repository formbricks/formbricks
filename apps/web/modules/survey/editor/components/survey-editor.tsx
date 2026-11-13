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
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import { ActionClass, Language, OrganizationRole } from "@formbricks/database/prisma-browser";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSegment } from "@formbricks/types/segment";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import {
  TSurvey,
  TSurveyEditorTabs,
  TSurveyStatus,
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
import { isDeepEqual } from "@/lib/utils/object";
import { useCustomCssValidation } from "@/modules/custom-css/components/hooks/use-custom-css-validation";
import { useLiveWorkspaceCustomCss } from "@/modules/custom-css/components/hooks/use-live-workspace-custom-css";
import { getCustomCssSource, toCustomCssDraft } from "@/modules/custom-css/components/lib/draft";
import { type TSurveyCustomCssEditorConfig } from "@/modules/custom-css/components/types";
import { isSurveyCustomCssApplied } from "@/modules/custom-css/lib/survey-css-gate";
import { useSurveyLinkedCreatives } from "@/modules/ee/creatives/hooks/use-survey-linked-creatives";
import type { TSurveyLinkedCreative } from "@/modules/ee/creatives/lib/survey-side";
import type { TSurveyDataRetentionContext } from "@/modules/ee/data-retention/types";
import { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { EditorIssueBar } from "@/modules/survey/editor/components/editor-issue-bar";
import { EditorIssuesProvider } from "@/modules/survey/editor/components/editor-issues-context";
import { ElementsView } from "@/modules/survey/editor/components/elements-view";
import { EMBEDDED_DATA_CARD_ID } from "@/modules/survey/editor/components/embedded-data-card";
import { FlowView } from "@/modules/survey/editor/components/flow-view";
import { LoadingSkeleton } from "@/modules/survey/editor/components/loading-skeleton";
import { ReviewView } from "@/modules/survey/editor/components/review-view";
import { SettingsView } from "@/modules/survey/editor/components/settings-view";
import { StylingView } from "@/modules/survey/editor/components/styling-view";
import { SurveyEditorTabs } from "@/modules/survey/editor/components/survey-editor-tabs";
import { SurveyMenuBar } from "@/modules/survey/editor/components/survey-menu-bar";
import { isCustomCssBlockingManualSave } from "@/modules/survey/editor/lib/custom-css-autosave";
import { describeRuleSummary } from "@/modules/survey/editor/lib/flow-outline-text";
import { hasSeenFlowTab, markFlowTabSeen } from "@/modules/survey/editor/lib/flow-tab-notice";
import { focusActiveTab, focusIssueTarget } from "@/modules/survey/editor/lib/focus-issue";
import {
  findIssueOwnerBlock,
  findRuleId,
  getElementToOpen,
  getIssueLocationDetail,
  getIssueSummaryLabel,
  mergeRepeatedIssues,
} from "@/modules/survey/editor/lib/issue-summary";
import { scrollElementCardIntoView } from "@/modules/survey/editor/lib/utils";
import {
  type TEditorIssue,
  type TIssueTab,
  areIssueListsEqual,
  collectEditorIssues,
  countIssuesByTab,
  getIssueTargetIds,
  getPublishTargetStatus,
  reconcileIssues,
} from "@/modules/survey/editor/lib/validation-issues";
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
import { type TErrorSummaryGroup, type TErrorSummaryItem } from "@/modules/ui/components/error-summary";
import { PreviewSurvey } from "@/modules/ui/components/preview-survey";
import { getWorkspaceLanguagesAction, refetchWorkspaceAction } from "../actions";

// How long the preview trails the editor. Every preview render re-mounts the whole survey bundle, so
// following each keystroke made typing lag on large surveys (ENG-991).
const PREVIEW_DEBOUNCE_MS = 300;
// How long the issue list trails the editor after a failed save, so typing is not parsed on every keystroke.
const ISSUE_RECHECK_DEBOUNCE_MS = 300;
const NO_ISSUES: TEditorIssue[] = [];
// Memoized so the editor's per-keystroke re-renders skip the preview while its debounced inputs are
// unchanged; without it the preview would still re-render (and re-mount the survey) every time.
const MemoizedPreviewSurvey = memo(PreviewSurvey);
// The "Logic has moved" flag changes only through this editor, which tracks it in state as well.
const subscribeToNothing = () => () => {};

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
  customCssEditor: TSurveyCustomCssEditorConfig;
  /** Null when the organisation isn't entitled to data retention. */
  dataRetention: TSurveyDataRetentionContext;
  /** The creatives that open this survey, read on the server (a survey they open publishes without a trigger). */
  linkedCreatives: TSurveyLinkedCreative[];
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
  customCssEditor,
  dataRetention,
  linkedCreatives: initialLinkedCreatives,
}: Readonly<SurveyEditorProps>) => {
  const linkedCreatives = useSurveyLinkedCreatives({
    workspaceId: survey.workspaceId,
    surveyId: survey.id,
    initialData: initialLinkedCreatives,
  });
  const isFollowUpsTabVisible = shouldShowFollowUpsTab({
    followUpCount: survey.followUps.length,
    isSurveyFollowUpsAllowed,
    isWorkflowsAllowed,
  });

  const [activeView, setActiveView] = useState<TSurveyEditorTabs>("elements");
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  // ENG-6929: the one-time "Logic has moved" notice, shown until the Flow tab has been opened once in
  // this browser. Read from storage on the client only (the server snapshot says "seen", so the notice
  // never flashes in and out on hydration); opening the Flow tab hides it for this page view even
  // where storage is refused.
  const hasSeenFlowInBrowser = useSyncExternalStore(subscribeToNothing, hasSeenFlowTab, () => true);
  const [hasOpenedFlow, setHasOpenedFlow] = useState(false);
  if (activeView === "flow" && !hasOpenedFlow) setHasOpenedFlow(true);
  useEffect(() => {
    if (activeView === "flow") markFlowTabSeen();
  }, [activeView]);
  const showLogicMovedNotice = !hasSeenFlowInBrowser && !hasOpenedFlow;
  // Set value's field picker, when the survey has no Calculated field: the card where one is added.
  const openEmbeddedDataCard = useCallback(() => {
    setActiveView("elements");
    setActiveElementId(EMBEDDED_DATA_CARD_ID);
    scrollElementCardIntoView(EMBEDDED_DATA_CARD_ID);
  }, []);
  // `localSurvey` must stay a structural clone of `survey`: the menu bar compares the two with
  // `isDeepEqual` to gate the draft auto-save, the back-navigation dialog and the beforeunload
  // prompt, and that comparison short-circuits on differing key counts. The inlined
  // `embeddedFields` is the editor's Embedded Data state (ENG-2628) — the Variables and Hidden
  // Fields cards edit it and every editor surface reads it — so it must arrive here exactly as the
  // server sent it and be sent back the same way, which is also what keeps that comparison honest.
  const [localSurvey, setLocalSurvey] = useState<TSurvey | null>(() => structuredClone(survey));
  // Only the preview trails; the editor panes keep reading `localSurvey` so input stays immediate.
  const debouncedPreviewSurvey = useDebouncedValue(localSurvey, PREVIEW_DEBOUNCE_MS);
  const { t, i18n } = useTranslation();
  // What stopped the last save or publish, and the status it was heading for. Null until one has been
  // refused, so nothing is flagged before the author tries to publish.
  const [issueReport, setIssueReport] = useState<{
    issues: TEditorIssue[];
    targetStatus: TSurveyStatus;
  } | null>(null);
  // A failed save or publish that is not about the survey's content: the server refused, or the network failed.
  const [systemError, setSystemError] = useState<string | null>(null);
  // Bumped on every refused attempt; the summary moves focus to its heading each time.
  const [summaryFocusRequest, setSummaryFocusRequest] = useState(0);
  // The attempt whose bar already took focus: leaving the review tab and coming back must not take it again.
  const [focusedSummaryRequest, setFocusedSummaryRequest] = useState(0);
  // Set when the review tab was opened from one of the bar's tab chips; it then lists only that tab's problems.
  const [reviewFilter, setReviewFilter] = useState<TIssueTab | null>(null);
  // The Flow tab's open blocks, kept here because the tab unmounts on every switch: coming back keeps
  // what was opened and closed. It opens with every block collapsed.
  // The rule a Review entry points at: the Flow tab opens it, so its fields exist when focus goes there.
  const [flowRuleToOpen, setFlowRuleToOpen] = useState<{ id: string; request: number } | null>(null);
  const [flowExpandedBlockIds, setFlowExpandedBlockIds] = useState<Set<string>>(() => new Set());
  const flowHandledInvalidRef = useRef<string[] | null>(null);
  const [hasIncompleteTranslations, setHasIncompleteTranslations] = useState(false);

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

  // `isFollowUpsTabVisible` tracks the server `survey` prop, which a manual save refreshes
  // (`updateSurveyAction` revalidates the route; the draft save calls `router.refresh()`). Deleting the last follow-up therefore hides the
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
  // (ENG-3553). Workspace CSS always applies; the survey's own only while its style overrides do.
  const surveyCustomCssValidation = useCustomCssValidation({
    workspaceId: workspace.id,
    scope: "survey",
    surveyId: survey.id,
    draft: toCustomCssDraft(getCustomCssSource(localSurvey?.customCss)),
    enabled: true,
  });
  // Workspace CSS saved in another tab reaches the preview and the inherited panel without a reload.
  const liveWorkspaceCss = useLiveWorkspaceCustomCss({
    workspaceId: workspace.id,
    enabled: true,
    initial: { source: customCssEditor.workspace.source, compiled: customCssEditor.workspace.compiled },
  });
  const workspaceCompiledCss = liveWorkspaceCss.compiled;
  const liveCustomCssEditor = useMemo(
    () => ({
      ...customCssEditor,
      workspace: {
        ...customCssEditor.workspace,
        source: liveWorkspaceCss.source,
        compiled: workspaceCompiledCss,
      },
    }),
    [customCssEditor, liveWorkspaceCss.source, workspaceCompiledCss]
  );
  const isSurveyCssApplied = isSurveyCustomCssApplied({
    allowStyleOverwrite: workspace.styling.allowStyleOverwrite,
    overwriteThemeStyling: localSurvey?.styling?.overwriteThemeStyling,
  });
  const surveyPreviewCss = isSurveyCssApplied ? surveyCustomCssValidation.previewCss : null;
  // Stable, so the memoized preview re-mounts the survey only when the validated CSS changes.
  const previewCustomCss = useMemo(
    () => ({ workspace: workspaceCompiledCss, survey: surveyPreviewCss }),
    [workspaceCompiledCss, surveyPreviewCss]
  );

  const fetchLatestWorkspaceData = useCallback(async () => {
    const [refetchWorkspaceResponse, refetchLanguagesResponse] = await Promise.all([
      refetchWorkspaceAction({ workspaceId: localWorkspace.id }),
      getWorkspaceLanguagesAction({ workspaceId: localWorkspace.id }),
    ]);

    // Kept by identity when nothing changed: a new object re-renders every block card and the preview.
    const workspaceData = refetchWorkspaceResponse?.data;
    if (workspaceData) {
      setLocalWorkspace((current) => (isDeepEqual(current, workspaceData) ? current : workspaceData));
    }

    const languagesData = refetchLanguagesResponse?.data;
    if (languagesData) {
      setLocalWorkspaceLanguages((current) =>
        isDeepEqual(current, languagesData) ? current : languagesData
      );
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

  // How the preview's banner reads a rule before the first question that screened it out: as the
  // Flow tab writes it (ENG-6969 T13 ①).
  const textLocale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const describeStartRule = useCallback(
    (rule: TSurveyBlockLogic, previewed: TSurvey) =>
      describeRuleSummary(rule, previewed, t, { locale: textLocale }),
    [t, textLocale]
  );

  const issues = issueReport?.issues ?? NO_ISSUES;
  // What the cards' red bars and borders are drawn from. A fresh array for every refused attempt, so a card
  // switches back to its Questions tab again on a second try.
  const invalidElements = useMemo(
    () =>
      issueReport ? getIssueTargetIds(issueReport.issues.filter((issue) => issue.tab === "elements")) : null,
    [issueReport]
  );
  // The same for the Flow tab, where rules and show-ifs are written: its rows and the Questions tab's cards
  // each only carry the problems that are theirs to fix.
  const invalidFlowIds = useMemo(
    () =>
      issueReport ? getIssueTargetIds(issueReport.issues.filter((issue) => issue.tab === "flow")) : null,
    [issueReport]
  );
  // The Survey Trigger card says so while a save is refused for a missing trigger (ENG-2581).
  const hasTriggerError = issues.some((issue) => issue.field === "trigger");

  const reportIssues = useCallback((found: TEditorIssue[], targetStatus: TSurveyStatus) => {
    setSystemError(null);
    setIssueReport({ issues: found, targetStatus });
    setSummaryFocusRequest((count) => count + 1);
  }, []);
  const clearIssues = useCallback(() => {
    setIssueReport(null);
    setSystemError(null);
  }, []);
  const reportSystemError = useCallback((message: string | null) => {
    setSystemError(message);
    if (message) setSummaryFocusRequest((count) => count + 1);
  }, []);

  const collectFor = (survey: TSurvey, targetStatus: TSurveyStatus) =>
    collectEditorIssues(
      {
        survey,
        selectedLanguageCode,
        finishedResponseCount,
        targetStatus,
        isOpenedByCreative: linkedCreatives.length > 0,
        isCustomCssBlocking: isCustomCssBlockingManualSave(surveyCustomCssValidation.status),
        locale,
      },
      t
    );

  // After a refused attempt the issues follow the survey as it is edited: fixed ones disappear, and the
  // summary goes away with the last one. The check runs when the survey settles, not when the report
  // changes, because a fresh report was built from the current survey already.
  const debouncedSurveyForIssues = useDebouncedValue(localSurvey, ISSUE_RECHECK_DEBOUNCE_MS);
  const issueReportRef = useRef(issueReport);
  useEffect(() => {
    issueReportRef.current = issueReport;
  }, [issueReport]);
  useEffect(() => {
    const report = issueReportRef.current;
    if (!report || !debouncedSurveyForIssues) return;
    // The custom CSS check is still running: its problem stays until it answers, and this runs again then.
    if (surveyCustomCssValidation.status === "pending") return;

    const next = reconcileIssues(report.issues, collectFor(debouncedSurveyForIssues, report.targetStatus));
    setIssueReport((current) => {
      if (!current) return current;
      if (next.length === 0) return null;
      return areIssueListsEqual(current.issues, next) ? current : { ...current, issues: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the comment above
  }, [debouncedSurveyForIssues, surveyCustomCssValidation.status]);

  if (!localSurvey) {
    return <LoadingSkeleton />;
  }

  // Opening the review tab is asking for the check: it runs against the survey as it is now, so the tab lists
  // everything in the way, and the cards carry the same problems when the author goes to fix them.
  const openReview = (filter: TIssueTab | null = null) => {
    setReviewFilter(filter);
    const targetStatus = issueReport?.targetStatus ?? getPublishTargetStatus(localSurvey);
    const found = collectFor(localSurvey, targetStatus);
    setIssueReport(found.length > 0 ? { issues: found, targetStatus } : null);
    setActiveView("review");
  };

  const handleTabChange = (tab: TSurveyEditorTabs) => {
    if (tab === "review") openReview();
    else setActiveView(tab);
  };

  const goToIssue = (issue: TEditorIssue) => {
    setActiveView(issue.tab);

    if (!issue.targetId) {
      // Nothing on the tab to land on (a Language or Settings entry): the tab itself, never the page body.
      focusActiveTab();
      return;
    }
    if (issue.tab === "elements") setActiveElementId(getElementToOpen(localSurvey, issue.targetId));
    // The Flow tab opens the block that holds the rule, the show-if's question, or is the show-if's own block.
    const owner = issue.tab === "flow" ? findIssueOwnerBlock(localSurvey, issue.targetId) : undefined;
    if (owner) setFlowExpandedBlockIds((current) => new Set(current).add(owner.id));
    const ruleId = issue.tab === "flow" ? findRuleId(localSurvey, issue.targetId) : null;
    if (ruleId) setFlowRuleToOpen((previous) => ({ id: ruleId, request: (previous?.request ?? 0) + 1 }));
    focusIssueTarget(issue);
  };

  const tabLabels: Record<TIssueTab, string> = {
    elements: t("common.questions"),
    flow: t("workspace.surveys.edit.flow.tab"),
    styling: t("common.styling"),
    language: t("common.language"),
    settings: t("common.settings"),
    followUps: t("workspace.surveys.edit.follow_ups"),
  };
  const summaryEntries = mergeRepeatedIssues(issues).map(({ issue, count }) => ({
    tab: issue.tab,
    item: {
      key: issue.key,
      label: getIssueSummaryLabel(issue, count, t),
      group: tabLabels[issue.tab],
      location: issue.location,
      locationDetail: getIssueLocationDetail(localSurvey, issue),
      onSelect: () => goToIssue(issue),
    } satisfies TErrorSummaryItem,
  }));
  const summaryItems: TErrorSummaryItem[] = summaryEntries.map((entry) => entry.item);

  // The bar's chips: how many problems each tab has.
  const tabCounts = countIssuesByTab(issues);
  const summaryGroups: TErrorSummaryGroup[] = tabCounts.map(({ tab, count }) => ({
    key: tab,
    label: tabLabels[tab],
    count,
    onSelect: () => openReview(tab),
  }));
  // A filter whose tab has since been fixed falls back to the whole list.
  const activeReviewFilter = tabCounts.some(({ tab }) => tab === reviewFilter) ? reviewFilter : null;
  const reviewItems = activeReviewFilter
    ? summaryEntries.filter((entry) => entry.tab === activeReviewFilter).map((entry) => entry.item)
    : summaryItems;

  // After the null guard, we can safely narrow the setter type for child components
  const setLocalSurveyNonNull = setLocalSurvey as Dispatch<SetStateAction<TSurvey>>;
  const previewSurvey = debouncedPreviewSurvey ?? localSurvey;

  const editor = (
    <div className="flex h-full w-full flex-col">
      <SurveyMenuBar
        setLocalSurvey={setLocalSurveyNonNull}
        localSurvey={localSurvey}
        survey={survey}
        activeId={activeView}
        setActiveId={setActiveView}
        onIssuesFound={reportIssues}
        onIssuesCleared={clearIssues}
        onSystemError={reportSystemError}
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
        isOpenedByCreative={linkedCreatives.length > 0}
      />
      {showRestrictedBanner({
        enforced: visibilityGate.enforced,
        visibility,
        access: surveyAccess,
      }) && (
        // A full-width strip under the menu bar, like the bar itself.
        <RestrictedSurveyBanner ownerName={ownerName} className="rounded-none border-x-0 border-t-0 px-5" />
      )}
      <EditorIssueBar
        items={summaryItems}
        groups={summaryGroups}
        problemCount={issues.length}
        systemError={systemError}
        isReviewOpen={activeView === "review"}
        onReviewAll={() => openReview()}
        shouldFocus={summaryFocusRequest > focusedSummaryRequest}
        onFocused={() => setFocusedSummaryRequest(summaryFocusRequest)}
      />
      <div className="relative z-0 flex flex-1 overflow-hidden">
        <main
          className="relative z-0 w-full overflow-y-auto bg-slate-50 focus:outline-hidden md:w-2/3"
          ref={surveyEditorRef}>
          <SurveyEditorTabs
            activeId={activeView}
            setActiveId={handleTabChange}
            reviewIssueCount={issues.length}
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
              selectedLanguageCode={selectedLanguageCode || "default"}
              isFormbricksCloud={isFormbricksCloud}
              isCxMode={isCxMode}
              locale={locale}
              responseCount={responseCount}
              isStorageConfigured={isStorageConfigured}
              quotas={quotas}
              isExternalUrlsAllowed={isExternalUrlsAllowed}
              showLogicMovedNotice={showLogicMovedNotice}
              onOpenFlow={() => setActiveView("flow")}
            />
          )}

          {activeView === "flow" && (
            <FlowView
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurveyNonNull}
              invalidElements={invalidFlowIds}
              expandedBlockIds={flowExpandedBlockIds}
              ruleToOpen={flowRuleToOpen}
              handledInvalidRef={flowHandledInvalidRef}
              onAddCalculatedField={openEmbeddedDataCard}
              setExpandedBlockIds={setFlowExpandedBlockIds}
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
              savedCustomCss={survey.customCss ?? null}
            />
          )}

          {activeView === "language" && (
            <LanguageView
              localSurvey={localSurvey}
              persistedSurvey={survey}
              setLocalSurvey={setLocalSurveyNonNull}
              workspaceLanguages={localWorkspaceLanguages}
              locale={locale}
              setHasIncompleteTranslations={setHasIncompleteTranslations}
            />
          )}

          {activeView === "settings" && (
            <SettingsView
              dataRetention={dataRetention}
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
              linkedCreatives={linkedCreatives}
            />
          )}

          {activeView === "review" && (
            <ReviewView
              items={reviewItems}
              problemCount={issues.length}
              filterLabel={activeReviewFilter ? tabLabels[activeReviewFilter] : undefined}
              filterCount={tabCounts.find(({ tab }) => tab === activeReviewFilter)?.count}
              onClearFilter={() => setReviewFilter(null)}
              focusRequest={summaryFocusRequest}
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
            // The Flow tab's preview is for trying the flow: editing a rule there must not pull it
            // back to the question last active on the Questions tab.
            elementId={activeView === "flow" ? null : activeElementId}
            workspace={localWorkspace}
            previewType={previewSurvey.type === "app" ? "modal" : "fullwidth"}
            languageCode={selectedLanguageCode}
            setLanguageCode={setSelectedLanguageCode}
            locale={locale}
            isSpamProtectionAllowed={isSpamProtectionAllowed}
            publicDomain={publicDomain}
            appearance={activeView === "styling" ? stylingAppearance : "light"}
            onAppearanceChange={
              activeView === "styling" && previewSurvey.type === "app" ? setStylingAppearance : undefined
            }
            customCss={previewCustomCss}
            describeStartRule={describeStartRule}
          />
        </aside>
      </div>
      <EditPublicSurveyAlertDialog open={isCautionDialogOpen} setOpen={setIsCautionDialogOpen} />
    </div>
  );

  return <EditorIssuesProvider value={issues}>{editor}</EditorIssuesProvider>;
};
