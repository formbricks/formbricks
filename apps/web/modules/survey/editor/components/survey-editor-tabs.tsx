"use client";

import { ProBadge } from "@/modules/ui/components/pro-badge";
import { useTranslate } from "@tolgee/react";
import { PaintbrushIcon, Rows3Icon, SettingsIcon } from "lucide-react";
import { type JSX, useMemo } from "react";
import { cn } from "@formbricks/lib/cn";
import { TSurveyEditorTabs } from "@formbricks/types/surveys/types";

interface Tab {
  id: TSurveyEditorTabs;
  label: string;
  icon: JSX.Element;
  isPro?: boolean;
}

interface SurveyEditorTabsProps {
  activeId: TSurveyEditorTabs;
  setActiveId: React.Dispatch<React.SetStateAction<TSurveyEditorTabs>>;
  isStylingTabVisible?: boolean;
  isCxMode: boolean;
  isSurveyFollowUpsAllowed: boolean;
}

export const SurveyEditorTabs = ({
  activeId,
  setActiveId,
  isStylingTabVisible,
  isCxMode,
  isSurveyFollowUpsAllowed = false,
}: SurveyEditorTabsProps) => {
  const { t } = useTranslate();
  const tabsComputed = useMemo(() => {
    const tabs: Tab[] = [
      {
        id: "questions",
        label: t("common.questions"),
        icon: <Rows3Icon className="h-5 w-5" />,
      },
      {
        id: "styling",
        label: t("common.styling"),
        icon: <PaintbrushIcon className="h-5 w-5" />,
      },
      {
        id: "settings",
        label: t("common.settings"),
        icon: <SettingsIcon className="h-5 w-5" />,
      },
      // {
      //   id: "rewards",
      //   label: t("common.rewards"),
      //   icon: <BadgeDollarSignIcon className="h-5 w-5" />,
      // },
      // {
      //   id: "followUps",
      //   label: t("environments.surveys.edit.follow_ups"),
      //   icon: <MailIcon className="h-5 w-5" />,
      //   isPro: !isSurveyFollowUpsAllowed,
      // },
    ];

    if (isStylingTabVisible) {
      return tabs;
    }
    return tabs.filter((tab) => tab.id !== "styling");
  }, [isStylingTabVisible, isSurveyFollowUpsAllowed]);

  // Hide settings tab in CX mode
  let tabsToDisplay = isCxMode ? tabsComputed.filter((tab) => tab.id !== "settings") : tabsComputed;

  return (
    <div className="fixed z-30 flex h-12 w-full items-center justify-center border-b bg-white md:w-1/2">
      <nav className="flex h-full items-center space-x-4" aria-label="Tabs">
        {tabsToDisplay.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              tab.id === activeId
                ? "border-brand-dark font-semibold text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700",
              "flex h-full items-center border-b-2 px-3 text-sm font-medium"
            )}
            aria-current={tab.id === activeId ? "page" : undefined}>
            {tab.icon && <div className="mr-2 h-5 w-5">{tab.icon}</div>}
            {tab.label}
            {tab.isPro && <ProBadge />}
          </button>
        ))}
      </nav>
    </div>
  );
};
