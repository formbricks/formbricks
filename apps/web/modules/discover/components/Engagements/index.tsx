"use client";

import { getCompletedSurveysAction } from "@/modules/discover/components/Engagements/actions";
import AvailableSurveys from "@/modules/discover/components/Engagements/components/available-engagements";
import CompletedSurveys from "@/modules/discover/components/Engagements/components/completed-engagements";
import { SearchSection } from "@/modules/discover/components/common/search-section";
import WelcomeBanner from "@/modules/discover/components/common/welcome-banner";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { ClipboardCheckIcon, ClipboardListIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";

export function Engagements({ className = "" }: { className?: string }): React.JSX.Element {
  const tabs = [
    {
      id: "available-surveys",
      label: "Available",
      icon: <ClipboardListIcon className="h-4 w-4" strokeWidth={2} />,
    },
    {
      id: "completed-surveys",
      label: "Completed",
      icon: <ClipboardCheckIcon className="h-4 w-4" strokeWidth={2} />,
    },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkCompletedSurveys = async () => {
      setIsLoading(true);
      try {
        const completedSurveys = await getCompletedSurveysAction({
          take: 1,
          skip: 0,
          searchQuery: "",
        });

        setShowWelcomeBanner(completedSurveys?.data?.length == 0);
      } catch (error) {
        console.error("Error checking completed surveys:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkCompletedSurveys();
  }, []);

  return (
    <>
      <div className={cn("relative my-4 flex w-full flex-col gap-2", className)} id={"surveys"}>
        {showWelcomeBanner && !isLoading && (
          <WelcomeBanner
            showWelcomeBanner={showWelcomeBanner}
            isLoading={isLoading}
            setShowWelcomeBanner={setShowWelcomeBanner}
          />
        )}
        <SearchSection setSearchQuery={setSearchQuery} />
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          setActiveId={setActiveTab}
          tabStyle="button"
          className="bg-slate-100"
        />
        <div className="grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {(() => {
            switch (activeTab) {
              case "available-surveys":
                return <AvailableSurveys searchQuery={searchQuery} />;
              case "completed-surveys":
                return <CompletedSurveys searchQuery={searchQuery} setActiveTab={setActiveTab} />;
              default:
                return <AvailableSurveys searchQuery={searchQuery} />;
            }
          })()}
        </div>
      </div>
    </>
  );
}

export default Engagements;
