"use client";

import { cn } from "@formbricks/lib/cn";

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
  const Nav = () => {
    if (tabStyle === "bar") {
      return (
        <nav className="flex h-full items-center space-x-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                tab.id === activeId
                  ? `border-brand-dark border-b-2 font-semibold text-slate-900 ${activeTabClassName}`
                  : "text-slate-500 hover:text-slate-700",
                "flex h-full items-center px-3 text-sm font-medium"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.icon && <div className="flex h-5 w-5 items-center">{tab.icon}</div>}
              {tab.label}
            </button>
          ))}
        </nav>
      );
    }

    if (tabStyle === "button") {
      return (
        <nav
          className={cn(
            "flex h-full w-full flex-1 items-center space-x-4",
            disabled ? "cursor-not-allowed opacity-50" : ""
          )}
          aria-label="Tabs">
          {tabs.map((tab) => (
            <div className="flex h-full flex-1 justify-center px-3 py-2" key={tab.id}>
              <button
                onClick={() => !disabled && setActiveId(tab.id)}
                type="button"
                className={cn(
                  tab.id === activeId
                    ? `bg-white font-semibold text-slate-900 ${activeTabClassName}`
                    : "text-slate-500",
                  "h-full w-full items-center rounded-lg text-center text-sm font-medium",
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
  };

  return (
    <div className={cn("flex h-14 w-full items-center justify-center rounded-t-md bg-slate-100", className)}>
      <Nav />
    </div>
  );
};
