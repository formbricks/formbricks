"use client";

import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { Button } from "@formbricks/ui/Button";
import { EmailTab } from "./EmailTab";
import { LinkTab } from "./LinkTab";
import { WebpageTab } from "./WebpageTab";

interface EmbedViewProps {
  handleInitialPageButton: () => void;
  tabs: Array<{ id: string; label: string; icon: any }>;
  activeId: string;
  setActiveId: React.Dispatch<React.SetStateAction<string>>;
  survey: any;
  email: string;
  surveyUrl: string;
  setSurveyUrl: React.Dispatch<React.SetStateAction<string>>;
  webAppUrl: string;
}

export const EmbedView = ({
  handleInitialPageButton,
  tabs,
  activeId,
  setActiveId,
  survey,
  email,
  surveyUrl,
  setSurveyUrl,
  webAppUrl,
}: EmbedViewProps) => {
  return (
    <div className="h-full overflow-hidden">
      <div className="border-b border-slate-200 py-2">
        <Button
          variant="minimal"
          className="focus:ring-0"
          onClick={handleInitialPageButton}
          StartIcon={ArrowLeftIcon}>
          Back
        </Button>
      </div>
      <div className="grid h-full grid-cols-4">
        <div className="col-span-1 hidden flex-col gap-3 border-r border-slate-200 p-4 lg:flex">
          {tabs.map((tab) => (
            <Button
              StartIcon={tab.icon}
              startIconClassName="h-4 w-4"
              variant="minimal"
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "rounded-md border px-4 py-2 text-slate-600",
                // "focus:ring-0 focus:ring-offset-0", // enable these classes to remove the focus rings on buttons
                tab.id === activeId
                  ? "border-slate-200 bg-slate-100 font-semibold text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
              aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="col-span-4 h-full overflow-y-auto bg-slate-50 px-4 py-6 lg:col-span-3 lg:p-6">
          <div>
            {activeId === "email" ? (
              <EmailTab surveyId={survey.id} email={email} />
            ) : activeId === "webpage" ? (
              <WebpageTab surveyUrl={surveyUrl} />
            ) : activeId === "link" ? (
              <LinkTab
                survey={survey}
                webAppUrl={webAppUrl}
                surveyUrl={surveyUrl}
                setSurveyUrl={setSurveyUrl}
              />
            ) : null}
          </div>
          <div className="mt-2 rounded-md p-3 text-center lg:hidden">
            {tabs.slice(0, 2).map((tab) => (
              <Button
                variant="minimal"
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={cn(
                  "rounded-md px-4 py-2",
                  tab.id === activeId
                    ? "bg-white text-slate-900 shadow-sm"
                    : "border-transparent text-slate-700 hover:text-slate-900"
                )}>
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
