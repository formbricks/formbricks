"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { ArrowLeftIcon } from "lucide-react";
import { TUserLocale } from "@formbricks/types/user";
import { AppTab } from "./AppTab";
import { EmailTab } from "./EmailTab";
import { LinkTab } from "./LinkTab";
import { WebsiteTab } from "./WebsiteTab";

interface EmbedViewProps {
  handleInitialPageButton: () => void;
  tabs: Array<{ id: string; label: string; icon: any }>;
  activeId: string;
  setActiveId: React.Dispatch<React.SetStateAction<string>>;
  environmentId: string;
  disableBack: boolean;
  survey: any;
  email: string;
  surveyUrl: string;
  surveyDomain: string;
  setSurveyUrl: React.Dispatch<React.SetStateAction<string>>;
  locale: TUserLocale;
}

export const EmbedView = ({
  handleInitialPageButton,
  tabs,
  disableBack,
  activeId,
  setActiveId,
  environmentId,
  survey,
  email,
  surveyUrl,
  surveyDomain,
  setSurveyUrl,
  locale,
}: EmbedViewProps) => {
  const { t } = useTranslate();
  return (
    <div className="h-full overflow-hidden">
      {!disableBack && (
        <div className="border-b border-slate-200 py-2 pl-2">
          <Button variant="ghost" className="focus:ring-0" onClick={handleInitialPageButton}>
            <ArrowLeftIcon />
            {t("common.back")}
          </Button>
        </div>
      )}
      <div className="grid h-full grid-cols-4">
        {survey.type === "link" && (
          <div className={cn("col-span-1 hidden flex-col gap-3 border-r border-slate-200 p-4 lg:flex")}>
            {tabs.map((tab) => (
              <Button
                variant="ghost"
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                autoFocus={tab.id === activeId}
                className={cn(
                  "flex justify-start rounded-md border px-4 py-2 text-slate-600",
                  // "focus:ring-0 focus:ring-offset-0", // enable these classes to remove the focus rings on buttons
                  tab.id === activeId
                    ? "border-slate-200 bg-slate-100 font-semibold text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
                aria-current={tab.id === activeId ? "page" : undefined}>
                <tab.icon />
                {tab.label}
              </Button>
            ))}
          </div>
        )}
        <div
          className={`col-span-4 h-full overflow-y-auto bg-slate-50 px-4 py-6 ${survey.type === "link" ? "lg:col-span-3" : ""} lg:p-6`}>
          {activeId === "email" ? (
            <EmailTab surveyId={survey.id} email={email} />
          ) : activeId === "webpage" ? (
            <WebsiteTab surveyUrl={surveyUrl} environmentId={environmentId} />
          ) : activeId === "link" ? (
            <LinkTab
              survey={survey}
              surveyUrl={surveyUrl}
              surveyDomain={surveyDomain}
              setSurveyUrl={setSurveyUrl}
              locale={locale}
            />
          ) : activeId === "app" ? (
            <AppTab />
          ) : null}
          <div className="mt-2 rounded-md p-3 text-center lg:hidden">
            {tabs.slice(0, 2).map((tab) => (
              <Button
                variant="ghost"
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
