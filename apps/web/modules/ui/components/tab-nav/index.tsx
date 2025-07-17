"use client";

import { cn } from "@/lib/cn";

interface TabNavProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeId: string;
  setActiveId: (id: string) => void;
  activeTabClassName?: string;
  disabled?: boolean;
}

interface NavProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeId: string;
  setActiveId: (id: string) => void;
  activeTabClassName?: string;
}

const Nav: React.FC<NavProps> = ({ tabs, activeId, setActiveId, activeTabClassName }) => {
  return (
    <nav className="flex h-full items-center space-x-3" aria-label="Tabs">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          onClick={() => setActiveId(tab.id)}
          className={cn(
            tab.id === activeId
              ? `border-brand-dark text-primary border-b-2 font-semibold ${activeTabClassName}`
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
};

export const TabNav: React.FC<TabNavProps> = ({ tabs, activeId, setActiveId, activeTabClassName }) => {
  return (
    <div className={cn("flex h-14 w-full items-center justify-center rounded-t-md")}>
      <Nav
        tabs={tabs}
        activeId={activeId}
        setActiveId={setActiveId}
        activeTabClassName={activeTabClassName}
      />
    </div>
  );
};
