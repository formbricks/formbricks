import { Rows3Icon, SettingsIcon } from "lucide-react";

import { cn } from "@formbricks/lib/cn";

interface Tab {
  id: "questions" | "settings";
  label: string;
  icon: JSX.Element;
}

const tabs: Tab[] = [
  {
    id: "questions",
    label: "Questions",
    icon: <Rows3Icon className="h-5 w-5" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon className="h-5 w-5" />,
  },
];

interface QuestionsAudienceTabsProps {
  activeId: "questions" | "settings";
  setActiveId: (id: "questions" | "settings") => void;
}

export default function QuestionsAudienceTabs({ activeId, setActiveId }: QuestionsAudienceTabsProps) {
  return (
    <div className="fixed z-10 flex h-14 w-full items-center justify-center border bg-white md:w-1/2">
      <nav className="flex h-full items-center space-x-4" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              tab.id === activeId
                ? " border-brand-dark border-b-2 font-semibold text-slate-900"
                : "text-slate-500 hover:text-slate-700",
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
