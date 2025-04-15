"use client";

import AvailableSurveys from "@/modules/activity/components/Surveys/components/available-surveys";
import CompletedSurveys from "@/modules/activity/components/Surveys/components/completed-surveys";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { Survey } from "@prisma/client";
import { ClipboardCheckIcon, ClipboardListIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { getAvailableSurveysAction, getCompletedSurveysAction } from "./actions";

export function Surveys({ className = "" }: { className?: string }): React.JSX.Element {
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

  return (
    <>
      <div className={cn("relative my-4 flex w-full flex-col gap-2", className)} id={"surveys"}>
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          setActiveId={setActiveTab}
          tabStyle="button"
          className="bg-slate-100"
        />
        <div className="grid md:grid-cols-3">
          {(() => {
            switch (activeTab) {
              case "available-surveys":
                return <AvailableSurveys />;
              case "completed-surveys":
                return <CompletedSurveys />;
              default:
                return <AvailableSurveys />;
            }
          })()}
        </div>
      </div>
    </>
  );
}

export default Surveys;
