"use client";

import {
  AlertTriangleIcon,
  ChevronRightIcon,
  Languages,
  MailIcon,
  PaintbrushIcon,
  Rows3Icon,
  SettingsIcon,
} from "lucide-react";
import { Fragment, type JSX, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyEditorTabs } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";

interface Tab {
  id: TSurveyEditorTabs;
  label: string;
  icon: JSX.Element;
  alert?: boolean;
}

interface SurveyEditorTabsProps {
  activeId: TSurveyEditorTabs;
  setActiveId: React.Dispatch<React.SetStateAction<TSurveyEditorTabs>>;
  isStylingTabVisible?: boolean;
  isCxMode: boolean;
  hasLanguageErrors?: boolean;
}

export const SurveyEditorTabs = ({
  activeId,
  setActiveId,
  isStylingTabVisible,
  isCxMode,
  hasLanguageErrors,
}: SurveyEditorTabsProps) => {
  const { t } = useTranslation();
  const tabsComputed = useMemo(() => {
    const tabs: Tab[] = [
      {
        id: "elements",
        label: t("common.questions"),
        icon: <Rows3Icon className="size-5" />,
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
    ];

    if (isStylingTabVisible) {
      return tabs;
    }
    return tabs.filter((tab) => tab.id !== "styling");
  }, [isStylingTabVisible, t, hasLanguageErrors]);

  const cxModeHiddenTabIds: TSurveyEditorTabs[] = ["settings", "language", "followUps"];
  const tabsToDisplay = isCxMode
    ? tabsComputed.filter((tab) => !cxModeHiddenTabIds.includes(tab.id))
    : tabsComputed;

  return (
    <div className="fixed z-30 flex h-12 w-full items-center justify-center border-b bg-white md:w-2/3">
      <nav className="flex h-full items-center gap-x-4" aria-label="Tabs">
        {tabsToDisplay.map((tab, index) => (
          <Fragment key={tab.id}>
            <button
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={cn(
                tab.id === activeId
                  ? "border-brand-dark font-semibold text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700",
                "flex h-full items-center border-b-2 px-3 text-sm font-medium"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.icon && <div className="mr-2 size-5">{tab.icon}</div>}
              {tab.label}
              {tab.alert && <AlertTriangleIcon className="ml-1.5 size-4 text-amber-500" />}
            </button>
            {index < tabsToDisplay.length - 1 && (
              <ChevronRightIcon className="size-4 text-slate-300" aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </nav>
    </div>
  );
};
