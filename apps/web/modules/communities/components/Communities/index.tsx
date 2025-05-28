// import { useTranslate } from "@tolgee/react";
import AvailableCommunities from "@/modules/communities/components/Communities/components/available-communities";
import MyCommunities from "@/modules/communities/components/Communities/components/my-communities";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { ClipboardCheckIcon, ClipboardListIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";

interface CommunitiesProps {
  searchQuery?: string;
  className?: string;
  environmentId: string;
}

export const Communities = ({ environmentId, searchQuery, className = "" }: CommunitiesProps) => {
  // const { t } = useTranslate();
  const tabs = [
    {
      id: "my-communities",
      label: "My Communities",
      icon: <ClipboardListIcon className="h-4 w-4" strokeWidth={2} />,
    },
    {
      id: "available-communities",
      label: "Explore",
      icon: <ClipboardCheckIcon className="h-4 w-4" strokeWidth={2} />,
    },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div className={cn("relative flex w-full flex-col", className)}>
      <TabBar
        tabs={tabs}
        activeId={activeTab}
        setActiveId={setActiveTab}
        tabStyle="button"
        className="bg-slate-100"
      />
      <div className="grid md:grid-cols-2 md:gap-4 lg:grid-cols-5">
        {(() => {
          switch (activeTab) {
            case "my-communities":
              return <MyCommunities environmentId={environmentId} searchQuery={searchQuery} />;
            case "available-communities":
              return <AvailableCommunities environmentId={environmentId} searchQuery={searchQuery} />;
            default:
              return <MyCommunities environmentId={environmentId} searchQuery={searchQuery} />;
          }
        })()}
      </div>
    </div>
  );
};
