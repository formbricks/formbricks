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
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { getCreativeSummaryPath, getCreativesPath } from "../../lib/paths";
import {
  PUBLISH_ISSUE_TABS,
  type TCreativeEditorTab,
  type TPublishIssue,
  getPublishIssues,
  getSaveIssues,
} from "../../lib/publish-check";
import { getMockDisplayState } from "../../mock/data";
import type { TCreative, TCreativeDevice } from "../../types";
import { CreativeTypeIndicator } from "../creative-icons";
import { CreativeStatusPill } from "../creative-status-pill";
import { MockDataBadge } from "../mock-data-badge";
import { ContentTab } from "./content-tab";
import { CreativePreview } from "./creative-preview";
import { ScheduleTab } from "./schedule-tab";
import { SettingsTab } from "./settings-tab";
import { StylingTab } from "./styling-tab";

const TAB_ICONS: Record<TCreativeEditorTab, LucideIcon> = {
  content: TypeIcon,
  styling: PaletteIcon,
  settings: Settings2Icon,
  schedule: CalendarClockIcon,
};

export const CreativeEditor = ({
  workspaceId,
  siteName,
  initialCreative,
}: Readonly<{ workspaceId: string; siteName: string; initialCreative: TCreative }>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [creative, setCreative] = useState(initialCreative);
  const [activeTab, setActiveTab] = useState<TCreativeEditorTab>("content");
  const [device, setDevice] = useState<TCreativeDevice>("desktop");
  // The action that last flagged something, so the flags can follow the edits that fix them.
  const [flaggedBy, setFlaggedBy] = useState<"save" | "publish" | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [now] = useState(() => new Date());

  const getIssues = { save: getSaveIssues, publish: getPublishIssues };
  const issues: TPublishIssue[] = flaggedBy ? getIssues[flaggedBy](creative) : [];
  const tabsWithIssues = new Set(issues.map((issue) => PUBLISH_ISSUE_TABS[issue]));
  const displayState = getMockDisplayState(creative, now);

  const tabLabels: Record<TCreativeEditorTab, string> = {
    content: t("workspace.creatives.editor.tab_content"),
    styling: t("common.styling"),
    settings: t("common.settings"),
    schedule: t("workspace.creatives.editor.schedule"),
  };
  const issueMessages: Record<TPublishIssue, string> = {
    name_missing: t("workspace.creatives.editor.issue_name_missing"),
    message_missing: t("workspace.creatives.editor.issue_message_missing"),
    survey_missing: t("workspace.creatives.editor.issue_survey_missing"),
    link_invalid: t("workspace.creatives.editor.issue_link_invalid"),
    condition_empty: t("workspace.creatives.editor.issue_condition_empty"),
    end_before_start: t("workspace.creatives.editor.end_before_start"),
  };

  // Takes the author to the first problem; returns whether there was one.
  const flag = (action: "save" | "publish", found: TPublishIssue[]): boolean => {
    setFlaggedBy(found.length > 0 ? action : null);
    if (found.length === 0) return false;
    const [first] = found;
    const tab = PUBLISH_ISSUE_TABS[first];
    if (tab) setActiveTab(tab);
    else nameRef.current?.focus();
    toast.error(issueMessages[first]);
    return true;
  };

  const save = () => {
    if (flag("save", getSaveIssues(creative))) return;
    toast.success(t("workspace.creatives.editor.toast_saved"));
  };

  const publish = () => {
    if (flag("publish", getPublishIssues(creative))) return;
    // Fake latency so the button's loading state can be reviewed.
    setIsPublishing(true);
    setTimeout(() => {
      const published: TCreative = {
        ...creative,
        status: "inProgress",
        publishedAt: new Date(),
        updatedAt: new Date(),
      };
      setCreative(published);
      setIsPublishing(false);
      const nextState = getMockDisplayState(published, new Date());
      toast.success(
        nextState.status === "scheduled"
          ? t("workspace.creatives.editor.toast_scheduled", { name: published.name })
          : t("workspace.creatives.editor.toast_live", { name: published.name })
      );
      if (published.id !== "new") router.push(getCreativeSummaryPath(workspaceId, published.id));
    }, 600);
  };

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
          value={creative.name}
          onChange={(event) => setCreative({ ...creative, name: event.target.value })}
          placeholder={t("workspace.creatives.untitled_creative")}
          aria-label={t("workspace.creatives.editor.name_label")}
          aria-invalid={issues.includes("name_missing") || undefined}
          className="h-9 w-56 min-w-0 rounded-md border border-transparent px-2 text-base font-semibold text-slate-900 transition-colors outline-none placeholder:font-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-300 aria-invalid:border-red-400 lg:w-72"
        />
        <span className="hidden sm:block">
          <CreativeTypeIndicator type={creative.type} />
        </span>
        <CreativeStatusPill state={displayState} />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <MockDataBadge />
          </span>
          {creative.status === "draft" ? (
            <>
              <Button variant="secondary" onClick={save}>
                {t("common.save")}
              </Button>
              <Button onClick={publish} loading={isPublishing}>
                <ZapIcon />
                {t("workspace.creatives.editor.publish")}
              </Button>
            </>
          ) : (
            <Button onClick={save}>{t("common.save")}</Button>
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
            {activeTab === "content" && <ContentTab creative={creative} onChange={setCreative} />}
            {activeTab === "styling" && (
              <StylingTab
                creative={creative}
                onChange={setCreative}
                device={device}
                onDeviceChange={setDevice}
              />
            )}
            {activeTab === "settings" && (
              <SettingsTab
                creative={creative}
                onChange={setCreative}
                showErrors={issues.includes("condition_empty")}
              />
            )}
            {activeTab === "schedule" && <ScheduleTab creative={creative} onChange={setCreative} />}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 bg-slate-100/70 lg:block">
          <CreativePreview
            creative={creative}
            siteName={siteName}
            device={device}
            onDeviceChange={setDevice}
          />
        </div>
      </div>
    </div>
  );
};
