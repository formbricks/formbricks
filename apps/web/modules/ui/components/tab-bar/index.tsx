"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface TabBarProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeId: string;
  setActiveId: (id: string) => void;
  className?: string;
  activeTabClassName?: string;
  tabStyle?: "bar" | "button";
  disabled?: boolean;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeId,
  setActiveId,
  className = "",
  activeTabClassName,
  tabStyle = "bar",
  disabled = false,
}) => {
  const { t } = useTranslation();
  let nav: React.ReactNode = null;

  if (tabStyle === "bar") {
    nav = (
      <nav className="flex h-full items-center gap-x-4" aria-label={t("common.tabs")}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              tab.id === activeId
                ? `border-b-2 border-brand-dark font-semibold text-slate-900 ${activeTabClassName}`
                : "text-slate-500 hover:text-slate-700",
              "flex h-full items-center px-3 text-sm font-medium"
            )}
            aria-current={tab.id === activeId ? "page" : undefined}>
            {tab.icon && <div className="flex size-5 items-center">{tab.icon}</div>}
            {tab.label}
          </button>
        ))}
      </nav>
    );
  } else if (tabStyle === "button") {
    nav = (
      <nav
        className={cn(
          "flex h-full w-full flex-1 items-center space-x-4",
          disabled ? "cursor-not-allowed opacity-50" : ""
        )}
        aria-label={t("common.tabs")}>
        {tabs.map((tab) => (
          <div className="flex h-full flex-1 justify-center p-1" key={tab.id}>
            <button
              onClick={() => !disabled && setActiveId(tab.id)}
              type="button"
              className={cn(
                tab.id === activeId
                  ? `bg-white font-semibold text-slate-900 ${activeTabClassName}`
                  : "text-slate-500",
                "h-full w-full items-center rounded-md text-center text-sm font-medium",
                disabled ? "cursor-not-allowed" : "hover:text-slate-700"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.label}
            </button>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className={cn("flex h-14 w-full items-center justify-center rounded-t-md bg-slate-100", className)}>
      {nav}
    </div>
  );
};
