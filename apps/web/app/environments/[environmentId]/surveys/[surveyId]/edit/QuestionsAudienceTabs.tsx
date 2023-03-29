import { cn } from "@formbricks/lib/cn";
import { QuestionMarkCircleIcon, UserGroupIcon } from "@heroicons/react/24/solid";

interface Tab {
  id: "questions" | "audience";
  label: string;
  icon: JSX.Element;
}

const tabs: Tab[] = [
  {
    id: "questions",
    label: "Questions",
    icon: <QuestionMarkCircleIcon />,
  },
  {
    id: "audience",
    label: "Audience",
    icon: <UserGroupIcon />,
  },
];

interface QuestionsAudienceTabsProps {
  activeId: "questions" | "audience";
  setActiveId: (id: "questions" | "audience") => void;
}

export default function QuestionsAudienceTabs({ activeId, setActiveId }: QuestionsAudienceTabsProps) {
  return (
    <div className="flex h-14 w-full items-center justify-center border bg-white">
      <nav className="flex h-full items-center space-x-4" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
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
