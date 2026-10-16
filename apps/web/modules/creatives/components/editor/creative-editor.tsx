"use client";

import {
  ArrowLeftIcon,
  CalendarClockIcon,
  type LucideIcon,
  PaletteIcon,
  Settings2Icon,
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
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";
import { useCreativeResource, useUpdateCreative } from "../../hooks/use-creative-editor";
import type { TDestinationSurveyOption } from "../../lib/destination-options";
import {
  type TCreativeEditorForm,
  type TCreativeResource,
  type TCreativeSaveIntent,
  buildCreativePatch,
  toCreativeEditorForm,
} from "../../lib/editor-form";
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
import { CREATIVE_CSS_SCOPE, getCreativeStyle } from "../../lib/style";
import { type TCreativeDevice, toStyleSource, withTheme } from "../../lib/styling-form";
import { createMockDraft } from "../../mock/data";
import type { TCreativeTargeting } from "../../types";
import { CreativeTypeIndicator } from "../creative-icons";
import { CreativeStatusPill } from "../creative-status-pill";
import { MockDataBadge } from "../mock-data-badge";
import { ContentTab } from "./content-tab";
import { CreativePreview } from "./creative-preview";
import type { TCreativeCustomCssConfig } from "./custom-css-panel";
import { ScheduleTab } from "./schedule-tab";
import { SettingsTab } from "./settings-tab";
import { StylingTab } from "./styling-tab";

const TAB_ICONS: Record<TCreativeEditorTab, LucideIcon> = {
  content: TypeIcon,
  styling: PaletteIcon,
  settings: Settings2Icon,
  schedule: CalendarClockIcon,
};

// `CreativeTypeIndicator` still speaks the mock's type names, like the list.
const INDICATOR_TYPES = { feedbackButton: "feedback_button", banner: "banner" } as const;

/** Show on and Show when are still the prototype's local state (ENG-4002). */
const createMockTargeting = (type: TCreativeResource["type"]): TCreativeTargeting =>
  createMockDraft(INDICATOR_TYPES[type]).targeting;

/** Whether the form would change the stored creative if saved now. */
const hasUnsavedChanges = (form: TCreativeEditorForm, creative: TCreativeResource): boolean =>
  JSON.stringify(buildCreativePatch(form, creative, "save")) !==
  JSON.stringify(buildCreativePatch(toCreativeEditorForm(creative), creative, "save"));

export const CreativeEditor = ({
  workspaceId,
  siteName,
  initialCreative,
  surveyOptions,
  workspaceStyling,
  customCss,
}: Readonly<{
  workspaceId: string;
  siteName: string;
  initialCreative: TCreativeResource;
  surveyOptions: TDestinationSurveyOption[];
  /** The workspace Look & Feel a creative starts from (never the linked survey's own styling). */
  workspaceStyling: TWorkspaceStyling;
  customCss: TCreativeCustomCssConfig;
}>) => {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLInputElement>(null);
  const { data: creative } = useCreativeResource(initialCreative);
  const updateCreative = useUpdateCreative(initialCreative.id);
  const [form, setForm] = useState(() => toCreativeEditorForm(initialCreative));
  const [targeting, setTargeting] = useState(() => createMockTargeting(initialCreative.type));
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

  const isDraft = creative.status === "draft";
  const isArchived = creative.archivedAt !== null;
  const getIssues = (intent: TCreativeSaveIntent): TPublishIssue[] =>
    intent === "publish" ? getPublishIssues(form) : getSaveIssues(form, { published: !isDraft });
  const issues = flaggedBy ? getIssues(flaggedBy) : [];
  const tabsWithIssues = new Set([...issues.map((issue) => PUBLISH_ISSUE_TABS[issue]), serverIssueTab]);
  const linkedSurveyId = creative.destination?.type === "survey" ? creative.destination.surveyId : null;
  const pickedSurveyId = form.destination.type === "survey" ? form.destination.surveyId : null;
  const pickedSurveyName = surveyOptions.find((option) => option.id === pickedSurveyId)?.name ?? null;

  useBeforeUnloadPrompt(() => hasUnsavedChanges(form, creative), { enabled: !isArchived });

  const tabLabels: Record<TCreativeEditorTab, string> = {
    content: t("workspace.creatives.editor.tab_content"),
    styling: t("common.styling"),
    settings: t("common.settings"),
    schedule: t("workspace.creatives.editor.schedule"),
  };
  const issueMessages: Record<TPublishIssue, string> = {
    name_missing: t("workspace.creatives.editor.issue_name_missing"),
    label_missing: t("workspace.creatives.editor.issue_label_missing"),
    message_missing: t("workspace.creatives.editor.issue_message_missing"),
    button_label_missing: t("workspace.creatives.editor.issue_button_label_missing"),
    survey_missing: t("workspace.creatives.editor.issue_survey_missing"),
    link_invalid: t("workspace.creatives.editor.issue_link_invalid"),
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

  const onSaveError = (error: Error) => {
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

  const onSaved = (intent: TCreativeSaveIntent, saved: TCreativeResource) => {
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

  const submit = (intent: TCreativeSaveIntent) => {
    if (flag(intent, getIssues(intent))) return;
    setServerIssueTab(null);
    setPendingIntent(intent);
    updateCreative.mutate(buildCreativePatch(form, creative, intent), {
      onSuccess: (saved) => onSaved(intent, saved),
      onError: onSaveError,
      onSettled: () => setPendingIntent(null),
    });
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-slate-600" asChild>
          <Link href={getCreativesPath(workspaceId)} aria-label={t("common.back")}>
            <ArrowLeftIcon />
          </Link>
        </Button>
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
        <span className="hidden sm:block">
          <CreativeTypeIndicator type={INDICATOR_TYPES[creative.type]} />
        </span>
        <CreativeStatusPill
          state={{ status: creative.displayStatus, reason: creative.displayStatusReason }}
        />
        <div className="ml-auto flex items-center gap-2">
          {isDraft ? (
            <>
              <Button
                variant="secondary"
                onClick={() => submit("save")}
                disabled={isArchived || isSaving}
                loading={pendingIntent === "save"}>
                {t("common.save")}
              </Button>
              <Button
                onClick={() => submit("publish")}
                disabled={isArchived || isSaving}
                loading={pendingIntent === "publish"}>
                <ZapIcon />
                {t("workspace.creatives.editor.publish")}
              </Button>
            </>
          ) : (
            <Button onClick={() => submit("save")} disabled={isArchived || isSaving} loading={isSaving}>
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
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
            {isArchived && (
              <Alert variant="info" size="small" role="status">
                <AlertDescription>{t("workspace.creatives.editor.archived_read_only")}</AlertDescription>
              </Alert>
            )}
            {activeTab === "settings" && <MockDataBadge />}
            {activeTab === "content" && (
              <ContentTab
                form={form}
                setForm={setForm}
                surveyOptions={surveyOptions}
                linkedSurveyId={linkedSurveyId}
                issues={issues}
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
              <SettingsTab targeting={targeting} onChange={setTargeting} showErrors={false} />
            )}
            {activeTab === "schedule" && (
              <ScheduleTab
                schedule={form.schedule}
                onChange={(schedule) => setForm((current) => ({ ...current, schedule }))}
              />
            )}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 bg-slate-100/70 lg:block">
          <CreativePreview
            view={toPreviewView(creative.id, form, style)}
            siteName={siteName}
            workspaceStyling={workspaceStyling}
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
    </div>
  );
};
