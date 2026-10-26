"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  LanguagesIcon,
  type LucideIcon,
  PaintbrushIcon,
  SettingsIcon,
  TypeIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TWorkspaceStyling } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import type { TStylingAppearance } from "@/lib/styling/dark-mode";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { useCustomCssValidation } from "@/modules/custom-css/components/hooks/use-custom-css-validation";
import { toCustomCssDraft } from "@/modules/custom-css/components/lib/draft";
import { workspaceSettingsPath } from "@/modules/settings/lib/routes";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";
import { useCreativeResource, useUpdateCreative } from "../../hooks/use-creative-editor";
import { useCreativeStatusChange } from "../../hooks/use-creative-status-change";
import { useCreativeWarningText } from "../../hooks/use-creative-warning-text";
import type { TDestinationSurveyOption } from "../../lib/destination-options";
import { destinationSurveyLanguagesQuery } from "../../lib/destination-survey-api";
import {
  type TCreativeEditorForm,
  type TCreativeResource,
  type TCreativeSaveIntent,
  buildCreativePatch,
  stopsOpeningSurvey,
  toCreativeEditorForm,
} from "../../lib/editor-form";
import { getOpenedSurveyName, surveyLeftUnopenedQuery } from "../../lib/last-opener-check";
import { getCreativesPath } from "../../lib/paths";
import { toPreviewView } from "../../lib/preview-view";
import {
  PUBLISH_ISSUE_TABS,
  type TCreativeEditorTab,
  type TPublishIssue,
  getInvalidParamTab,
  getPublishIssues,
  getSaveIssues,
} from "../../lib/publish-check";
import { keepSaveFromGoingLive, toSurveyStates } from "../../lib/save-status";
import { CREATIVE_CSS_SCOPE, getCreativeStyle } from "../../lib/style";
import { type TCreativeDevice, toStyleSource, withTheme } from "../../lib/styling-form";
import { getSummaryStatusControl, isWaitingForStart } from "../../lib/summary";
import { CreativeTypeIcon } from "../creative-icons";
import { CreativeStatusPill } from "../creative-status-pill";
import { LastOpenerConfirmationModal } from "../last-opener-confirmation-modal";
import { CreativeStatusDropdown } from "../summary/creative-status-dropdown";
import { ContentTab } from "./content-tab";
import { CreativePreview } from "./creative-preview";
import type { TCreativeCustomCssConfig } from "./custom-css-panel";
import { LanguageTab } from "./language-tab";
import { SettingsTab, type TCreativeActionOption } from "./settings-tab";
import { StylingTab } from "./styling-tab";

/** The survey editor's icons for the tabs both editors have (Language, Styling, Settings). */
const TAB_ICONS: Record<TCreativeEditorTab, LucideIcon> = {
  content: TypeIcon,
  language: LanguagesIcon,
  styling: PaintbrushIcon,
  settings: SettingsIcon,
};

/** Whether the form would change the stored creative if saved now. */
const hasUnsavedChanges = (form: TCreativeEditorForm, creative: TCreativeResource): boolean =>
  JSON.stringify(buildCreativePatch(form, creative, "save")) !==
  JSON.stringify(buildCreativePatch(toCreativeEditorForm(creative), creative, "save"));

export const CreativeEditor = ({
  workspaceId,
  siteName,
  initialCreative,
  linkedSurvey,
  actionOptions,
  workspaceStyling,
  customCss,
  workspaceLanguageCodes,
  isReadOnly,
}: Readonly<{
  workspaceId: string;
  siteName: string;
  initialCreative: TCreativeResource;
  /** The survey the creative opens, read with it; the picker searches for any other. */
  linkedSurvey: TDestinationSurveyOption | null;
  /** The workspace's actions, for Show on: When an action fires. */
  actionOptions: TCreativeActionOption[];
  /** The workspace Look & Feel a creative starts from (never the linked survey's own styling). */
  workspaceStyling: TWorkspaceStyling;
  customCss: TCreativeCustomCssConfig;
  /** The workspace's languages the Language tab offers (ENG-4003). */
  workspaceLanguageCodes: string[];
  /** A member who can only read: everything shows, nothing saves (as for an archived creative). */
  isReadOnly: boolean;
}>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toWarningText = useCreativeWarningText();
  const nameRef = useRef<HTMLInputElement>(null);
  const { data: creative } = useCreativeResource(initialCreative);
  const updateCreative = useUpdateCreative(initialCreative.id);
  const statusChange = useCreativeStatusChange(initialCreative.id);
  const [form, setForm] = useState(() => toCreativeEditorForm(initialCreative));
  // Every Destination survey the editor has seen: the one the creative opened on load and each one
  // picked since (the form keeps only the id), so the Save rule reads both sides of a relink.
  const [knownSurveys, setKnownSurveys] = useState<ReadonlyMap<string, TDestinationSurveyOption>>(
    () => new Map(linkedSurvey ? [[linkedSurvey.id, linkedSurvey]] : [])
  );
  const [activeTab, setActiveTab] = useState<TCreativeEditorTab>("content");
  const [device, setDevice] = useState<TCreativeDevice>("desktop");
  const [appearance, setAppearance] = useState<TStylingAppearance>("light");
  const cssValidation = useCustomCssValidation({
    workspaceId,
    scope: CREATIVE_CSS_SCOPE,
    creativeType: form.styling.type,
    draft: toCustomCssDraft(form.styling.theme.customCss),
    enabled: form.styling.theme.customStyles,
  });
  // The action that last flagged something, so the flags follow the edits that fix them.
  const [flaggedBy, setFlaggedBy] = useState<TCreativeSaveIntent | null>(null);
  // The tab holding a field the server refused, until the next attempt.
  const [serverIssueTab, setServerIssueTab] = useState<TCreativeEditorTab | null>(null);
  const [pendingIntent, setPendingIntent] = useState<TCreativeSaveIntent | null>(null);
  // A save waiting for "Save anyway": it would leave the linked survey with nothing that opens it.
  const [relinkWarningIntent, setRelinkWarningIntent] = useState<TCreativeSaveIntent | null>(null);

  const isDraft = creative.status === "draft";
  const isArchived = creative.archivedAt !== null;
  const canSave = !isArchived && !isReadOnly;
  // A linked survey that can no longer be a Destination stays picked but blocks Publish (it is flagged).
  const notAllowedSurveyIds = [...knownSurveys.values()]
    .filter((option) => option.notAllowed)
    .map(({ id }) => id);
  const getIssues = (intent: TCreativeSaveIntent): TPublishIssue[] =>
    intent === "publish"
      ? getPublishIssues(form, { notAllowedSurveyIds })
      : getSaveIssues(form, { published: !isDraft });
  const issues = flaggedBy ? getIssues(flaggedBy) : [];
  const tabsWithIssues = new Set([...issues.map((issue) => PUBLISH_ISSUE_TABS[issue]), serverIssueTab]);
  const linkedSurveyId = creative.destination?.type === "survey" ? creative.destination.surveyId : null;
  const pickedSurveyId = form.destination.type === "survey" ? form.destination.surveyId : null;
  // Its languages are read on their own, for the language warning (ENG-4003); unknown until then.
  const { data: pickedSurveyLanguages } = useQuery({
    ...destinationSurveyLanguagesQuery(pickedSurveyId ?? ""),
    enabled: pickedSurveyId !== null,
  });
  const knownPickedSurvey = pickedSurveyId ? (knownSurveys.get(pickedSurveyId) ?? null) : null;
  const pickedSurvey =
    knownPickedSurvey && pickedSurveyLanguages
      ? { ...knownPickedSurvey, languages: pickedSurveyLanguages }
      : knownPickedSurvey;
  const pickedSurveyName = pickedSurvey?.name ?? null;

  useBeforeUnloadPrompt(() => hasUnsavedChanges(form, creative), { enabled: canSave });

  const tabLabels: Record<TCreativeEditorTab, string> = {
    content: t("workspace.creatives.editor.tab_content"),
    language: t("common.language"),
    styling: t("common.styling"),
    settings: t("common.settings"),
  };
  const issueMessages: Record<TPublishIssue, string> = {
    name_missing: t("workspace.creatives.editor.issue_name_missing"),
    label_missing: t("workspace.creatives.editor.issue_label_missing"),
    message_missing: t("workspace.creatives.editor.issue_message_missing"),
    button_label_missing: t("workspace.creatives.editor.issue_button_label_missing"),
    survey_missing: t("workspace.creatives.editor.issue_survey_missing"),
    survey_not_allowed: t("workspace.creatives.editor.survey_not_allowed_note"),
    link_invalid: t("workspace.creatives.editor.issue_link_invalid"),
    action_missing: t("workspace.creatives.editor.issue_action_missing"),
    condition_incomplete: t("workspace.creatives.editor.issue_condition_incomplete"),
    end_before_start: t("workspace.creatives.editor.end_before_start"),
  };

  const goTo = (tab: TCreativeEditorTab | null) => {
    if (tab) setActiveTab(tab);
    else nameRef.current?.focus();
  };

  // Takes the author to the first problem; returns whether there was one.
  const flag = (intent: TCreativeSaveIntent, found: TPublishIssue[]): boolean => {
    setFlaggedBy(found.length > 0 ? intent : null);
    if (found.length === 0) return false;
    const [first] = found;
    goTo(PUBLISH_ISSUE_TABS[first]);
    toast.error(issueMessages[first]);
    return true;
  };

  // Someone else saved it (or its status changed) since this editor loaded it: the save would overwrite
  // what they did, so the server refused it. Reloading shows theirs; the edits here are lost.
  const toastChangedSinceOpened = () =>
    toast.error(
      () => (
        <span className="flex items-center gap-3">
          <span>{t("workspace.creatives.editor.changed_since_opened")}</span>
          <button
            type="button"
            className="shrink-0 text-sm font-medium text-slate-900 underline hover:text-slate-700"
            onClick={() => globalThis.location.reload()}>
            {t("common.reload_page")}
          </button>
        </span>
      ),
      { id: "creative-changed-since-opened", duration: Infinity }
    );

  const onSaveError = (error: Error) => {
    if (error instanceof V3ApiError && error.status === 409 && error.code === "conflict") {
      toastChangedSinceOpened();
      return;
    }
    const refused = error instanceof V3ApiError ? error.invalid_params?.[0] : undefined;
    if (refused) {
      const tab = getInvalidParamTab(refused.name);
      setServerIssueTab(tab);
      if (tab || refused.name === "name") goTo(tab);
    }
    toast.error(
      refused?.reason ?? getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))
    );
  };

  // The save paused it rather than take it live; going live is the author's own step.
  const toastKeptPaused = () =>
    toast.success(
      (item) => (
        <span className="flex items-center gap-3">
          <span>{t("workspace.creatives.editor.toast_saved_kept_paused")}</span>
          <button
            type="button"
            className="shrink-0 text-sm font-medium text-slate-900 underline hover:text-slate-700"
            onClick={() => {
              toast.dismiss(item.id);
              statusChange.changeStatus("inProgress");
            }}>
            {t("workspace.creatives.status_action_resume")}
          </button>
        </span>
      ),
      { duration: 10000 }
    );

  const onSaved = (intent: TCreativeSaveIntent, saved: TCreativeResource, keptPaused: boolean) => {
    if (keptPaused) {
      toastKeptPaused();
      return;
    }
    if (intent === "save") {
      toast.success(t("workspace.creatives.editor.toast_saved"));
      return;
    }
    const toasts: Partial<Record<TCreativeResource["displayStatus"], string>> = {
      active: t("workspace.creatives.editor.toast_live", { name: saved.name }),
      scheduled: t("workspace.creatives.editor.toast_scheduled", { name: saved.name }),
    };
    toast.success(
      toasts[saved.displayStatus] ?? t("workspace.creatives.editor.toast_published", { name: saved.name })
    );
  };

  const submit = async (intent: TCreativeSaveIntent, { confirmed = false } = {}) => {
    if (flag(intent, getIssues(intent))) return;
    // A Save never takes it live by itself (`save-status.ts`); Publish is the author going live.
    const { body, keptPaused } = keepSaveFromGoingLive(creative, buildCreativePatch(form, creative, intent), {
      surveys: toSurveyStates([...knownSurveys.values()]),
      now: new Date(),
    });
    // A relink that leaves a live app survey nothing opens asks first; the save is allowed anyway.
    if (!confirmed && creative.archivedAt === null && stopsOpeningSurvey(creative, body)) {
      setPendingIntent(intent);
      const leavesSurveyUnopened = await queryClient.fetchQuery(
        surveyLeftUnopenedQuery(workspaceId, creative)
      );
      setPendingIntent(null);
      if (leavesSurveyUnopened) {
        setRelinkWarningIntent(intent);
        return;
      }
    }
    setRelinkWarningIntent(null);
    setServerIssueTab(null);
    setPendingIntent(intent);
    // Refused (409) if the creative changed since this editor last read it, rather than overwriting that.
    updateCreative.mutate(
      { ...body, expectedUpdatedAt: creative.updatedAt },
      {
        onSuccess: (saved) => onSaved(intent, saved, keptPaused),
        onError: onSaveError,
        onSettled: () => setPendingIntent(null),
      }
    );
  };

  // The look the visitor gets, computed as the server computes it for the environment payload.
  const style = getCreativeStyle(toStyleSource(form.styling), workspaceStyling, cssValidation.previewCss);
  const workspaceStyle = getCreativeStyle(
    toStyleSource(withTheme(form.styling, { customStyles: false })),
    workspaceStyling
  );

  // On a site a press opens the Destination; here it says what it would open.
  const onPreviewActivate = () => {
    const { destination } = form;
    const url = destination.type === "link" ? destination.url.trim() : "";
    if (destination.type === "survey" && pickedSurveyName) {
      toast(t("workspace.creatives.editor.preview_opens_survey", { name: pickedSurveyName }));
    } else if (url) {
      toast(t("workspace.creatives.editor.preview_opens_link", { url }));
    } else {
      toast(t("workspace.creatives.editor.preview_no_action"));
    }
  };

  const isSaving = updateCreative.isPending;
  // One write at a time: a save decides on the status the menu may be changing.
  const isBusy = isSaving || statusChange.isPending;
  // Like the summary: a published creative's menu (Active · Paused · Closed); a Draft goes live with Publish.
  // The editor only opens with full access: its page sends wind-down to the summary.
  const statusControl = getSummaryStatusControl(creative, isReadOnly, "full");
  const displayState = { status: creative.displayStatus, reason: creative.displayStatusReason };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-slate-600" asChild>
          <Link href={getCreativesPath(workspaceId)} aria-label={t("common.back")}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-1">
          <CreativeTypeIcon type={creative.type} />
          <input
            ref={nameRef}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder={t("workspace.creatives.untitled_creative")}
            aria-label={t("workspace.creatives.editor.name_label")}
            aria-invalid={issues.includes("name_missing") || undefined}
            maxLength={255}
            className="h-9 w-56 min-w-0 rounded-md border border-transparent px-2 text-base font-semibold text-slate-900 transition-colors outline-none placeholder:font-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-300 aria-invalid:border-red-400 lg:w-72"
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {statusControl.kind === "select" ? (
            <CreativeStatusDropdown
              value={statusControl.value}
              options={statusControl.options}
              state={displayState}
              isWaitingForStart={isWaitingForStart(creative.schedule, new Date())}
              disabled={isBusy}
              onChange={statusChange.changeStatus}
              className="w-36"
            />
          ) : (
            <CreativeStatusPill state={displayState} />
          )}
          {isDraft ? (
            <>
              <Button
                variant="secondary"
                onClick={() => void submit("save")}
                disabled={!canSave || isBusy}
                loading={pendingIntent === "save"}>
                {t("common.save")}
              </Button>
              <Button
                onClick={() => void submit("publish")}
                disabled={!canSave || isBusy}
                loading={pendingIntent === "publish"}>
                <ZapIcon />
                {t("workspace.creatives.editor.publish")}
              </Button>
            </>
          ) : (
            <Button onClick={() => void submit("save")} disabled={!canSave || isBusy} loading={isSaving}>
              {t("common.save")}
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:w-[30rem] xl:w-[34rem]">
          <nav
            className="flex h-12 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-slate-200 px-3"
            aria-label={t("workspace.creatives.editor.sections")}>
            {(Object.keys(TAB_ICONS) as TCreativeEditorTab[]).map((tab) => {
              const Icon = TAB_ICONS[tab];
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "border-brand-dark text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}>
                  <Icon className="size-4" aria-hidden="true" />
                  {tabLabels[tab]}
                  {tabsWithIssues.has(tab) && (
                    <span className="size-1.5 rounded-full bg-red-500" aria-label={t("common.error")} />
                  )}
                </button>
              );
            })}
          </nav>
          {/*
            `relative`: the scroll box must be the containing block of absolutely positioned content
            (`sr-only` text, hidden form inputs). Otherwise that content is placed against the page
            instead, below the fold, and makes the document itself scroll: the editor then slid up
            out of view while the form was scrolled.
          */}
          <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
            {/* What the saved creative needs (`warnings[]`), whichever tab fixes it. */}
            {creative.warnings.length > 0 && (
              <Alert variant="warning" size="small" role="status">
                <AlertDescription>
                  <ul className="space-y-1">
                    {creative.warnings.map((warning) => (
                      <li key={warning.code}>{toWarningText(warning)}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {(isArchived || isReadOnly) && (
              <Alert variant="info" size="small" role="status">
                <AlertDescription>
                  {isArchived
                    ? t("workspace.creatives.editor.archived_read_only")
                    : t("workspace.creatives.editor.member_read_only")}
                </AlertDescription>
              </Alert>
            )}
            {activeTab === "content" && (
              <ContentTab
                form={form}
                setForm={setForm}
                surveyPicker={{
                  workspaceId,
                  pickedSurvey,
                  linkedSurvey: linkedSurveyId ? (knownSurveys.get(linkedSurveyId) ?? null) : null,
                  onPickSurvey: (survey) =>
                    setKnownSurveys((current) => new Map(current).set(survey.id, survey)),
                }}
                issues={issues}
              />
            )}
            {activeTab === "language" && (
              <LanguageTab
                workspaceId={workspaceId}
                form={form}
                setForm={setForm}
                workspaceLanguageCodes={workspaceLanguageCodes}
                survey={pickedSurvey}
              />
            )}
            {activeTab === "styling" && (
              <StylingTab
                styling={form.styling}
                onChange={(styling) => setForm((current) => ({ ...current, styling }))}
                style={style}
                workspaceStyle={workspaceStyle}
                device={device}
                onDeviceChange={setDevice}
                appearance={appearance}
                onAppearanceChange={setAppearance}
                customCss={{ config: customCss, validation: cssValidation }}
              />
            )}
            {activeTab === "settings" && (
              <SettingsTab
                distribution={form.distribution}
                onDistributionChange={(distribution) => setForm((current) => ({ ...current, distribution }))}
                schedule={form.schedule}
                onScheduleChange={(schedule) => setForm((current) => ({ ...current, schedule }))}
                actionOptions={actionOptions}
                userActionsHref={workspaceSettingsPath(workspaceId, "user-actions")}
                showActionError={issues.includes("action_missing")}
                showConditionErrors={issues.includes("condition_incomplete")}
              />
            )}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 bg-slate-100/70 lg:block">
          <CreativePreview
            view={toPreviewView(creative.id, form, style, {
              siteNotice: t("workspace.creatives.visitor_site_notice"),
              dismiss: t("workspace.creatives.visitor_dismiss"),
            })}
            siteName={siteName}
            device={device}
            onDeviceChange={setDevice}
            appearance={appearance}
            onAppearanceChange={setAppearance}
            actions={{
              onActivate: onPreviewActivate,
              onDismiss: () => toast(t("workspace.creatives.editor.preview_dismiss")),
              onLinkPress: (url) => toast(t("workspace.creatives.editor.preview_opens_link", { url })),
            }}
          />
        </div>
      </div>

      <LastOpenerConfirmationModal
        open={relinkWarningIntent !== null}
        onClose={() => setRelinkWarningIntent(null)}
        surveyName={getOpenedSurveyName(creative)}
        description={t("workspace.creatives.editor.relink_undo_note")}
        confirmText={t("workspace.creatives.editor.save_anyway")}
        isConfirming={isSaving}
        onConfirm={() => {
          if (relinkWarningIntent) void submit(relinkWarningIntent, { confirmed: true });
        }}
      />
    </div>
  );
};
