"use client";

import {
  AlertTriangleIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  Languages,
  MailIcon,
  PaintbrushIcon,
  Rows3Icon,
  SettingsIcon,
  SplitIcon,
} from "lucide-react";
import { Fragment, type JSX, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyEditorTabs } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";

interface Tab {
  id: TSurveyEditorTabs;
  label: string;
  icon: JSX.Element;
  alert?: boolean;
  /** A red count, for tabs that carry problems. */
  badge?: number;
}

interface SurveyEditorTabsProps {
  activeId: TSurveyEditorTabs;
  setActiveId: (id: TSurveyEditorTabs) => void;
  isStylingTabVisible?: boolean;
  /** Follow-ups are deprecated — see `shouldShowFollowUpsTab` for who still gets the tab. */
  isFollowUpsTabVisible?: boolean;
  isCxMode: boolean;
  hasLanguageErrors?: boolean;
  /** How many problems the review tab would list; shown as a red count once a save has been refused. */
  reviewIssueCount?: number;
}

export const SurveyEditorTabs = ({
  activeId,
  setActiveId,
  isStylingTabVisible,
  isFollowUpsTabVisible,
  isCxMode,
  hasLanguageErrors,
  reviewIssueCount,
}: Readonly<SurveyEditorTabsProps>) => {
  const { t } = useTranslation();
  const tabsComputed = useMemo(() => {
    const tabs: Tab[] = [
      {
        id: "elements",
        label: t("common.questions"),
        icon: <Rows3Icon className="size-5" />,
      },
      {
        // ENG-6929: the whole flow on one outline. Shown in CX mode too, which keeps the logic it had.
        id: "flow",
        label: t("workspace.surveys.edit.flow.tab"),
        icon: <SplitIcon className="size-5 rotate-90" />,
      },
      {
        id: "styling",
        label: t("common.styling"),
        icon: <PaintbrushIcon className="size-5" />,
      },
      {
        id: "language",
        label: t("common.language"),
        icon: <Languages className="size-5" />,
        alert: hasLanguageErrors,
      },
      {
        id: "settings",
        label: t("common.settings"),
        icon: <SettingsIcon className="size-5" />,
      },
      {
        id: "followUps",
        label: t("workspace.surveys.edit.follow_ups"),
        icon: <MailIcon className="size-5" />,
      },
      {
        // Last, where the tabs' own chevrons point: everything standing between the survey and publishing.
        id: "review",
        label: t("workspace.surveys.edit.review_tab"),
        icon: <ClipboardCheckIcon className="size-5" />,
        badge: reviewIssueCount,
      },
    ];

    return tabs.filter((tab) => {
      if (tab.id === "styling") return !!isStylingTabVisible;
      if (tab.id === "followUps") return !!isFollowUpsTabVisible;
      return true;
    });
  }, [isStylingTabVisible, isFollowUpsTabVisible, t, hasLanguageErrors, reviewIssueCount]);

  const cxModeHiddenTabIds = new Set<TSurveyEditorTabs>(["settings", "language", "followUps"]);
  const tabsToDisplay = isCxMode
    ? tabsComputed.filter((tab) => !cxModeHiddenTabIds.has(tab.id))
    : tabsComputed;

  const navRef = useRef<HTMLElement>(null);
  // Narrow columns scroll the tab strip: the tab just opened (the review tab, last) must never sit out of sight.
  useEffect(() => {
    navRef.current
      ?.querySelector("[aria-current=page]")
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId]);

  return (
    // A container, so the tabs compact by the width of this column (the preview takes a third of the page),
    // not by the page: seven tabs with icons and arrows need about 1150px, and fall back to plain labels below.
    <div className="@container fixed z-30 flex h-12 w-full items-center justify-center border-b bg-white md:w-2/3">
      <nav
        ref={navRef}
        className="flex h-full max-w-full items-center gap-x-0 overflow-x-auto @xl:gap-x-1 @4xl:gap-x-4"
        aria-label="Tabs">
        {tabsToDisplay.map((tab, index) => (
          <Fragment key={tab.id}>
            <button
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={cn(
                tab.id === activeId
                  ? "border-brand-dark font-semibold text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700",
                "flex h-full items-center border-b-2 px-1 text-sm font-medium whitespace-nowrap @xl:px-2 @4xl:px-3"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.icon && <div className="mr-2 hidden size-5 @6xl:block">{tab.icon}</div>}
              {tab.label}
              {tab.alert && <AlertTriangleIcon className="ml-1.5 size-4 text-amber-500" />}
              {tab.badge ? (
                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                  {tab.badge}
                </span>
              ) : null}
            </button>
            {index < tabsToDisplay.length - 1 && (
              <ChevronRightIcon
                className="hidden size-4 shrink-0 text-slate-300 @3xl:block"
                aria-hidden="true"
              />
            )}
          </Fragment>
        ))}
      </nav>
    </div>
  );
};
