"use client";

import { cn } from "@/lib/utils";

interface SecondNavbarProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeId: string;
  setActiveId: (id: string) => void;
}

export default function TabBar({ tabs, activeId, setActiveId }: SecondNavbarProps) {
  return (
    <div className="flex h-14 w-full items-center justify-center border-b bg-slate-50">
      <nav className="flex h-full items-center space-x-4" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              tab.id === activeId
                ? " border-brand-dark border-b-2 font-semibold text-gray-900"
                : "text-gray-500 hover:text-gray-700",
              "flex h-full items-center px-3 text-sm font-medium"
            )}
            aria-current={tab.id === activeId ? "page" : undefined}>
            {tab.icon && <div className="mr-2 h-5 w-5">{tab.icon}</div>}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
