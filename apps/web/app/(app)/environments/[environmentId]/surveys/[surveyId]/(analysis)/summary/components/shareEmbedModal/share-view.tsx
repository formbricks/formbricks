"use client";

import { DynamicPopupTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/DynamicPopupTab";
import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/TabContainer";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/modules/ui/components/sidebar";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Small } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { useEffect, useState } from "react";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { AppTab } from "./AppTab";
import { EmailTab } from "./EmailTab";
import { LinkTab } from "./LinkTab";
import { WebsiteEmbedTab } from "./WebsiteEmbedTab";
import { PersonalLinksTab } from "./personal-links-tab";

interface ShareViewProps {
  tabs: Array<{ id: string; label: string; icon: React.ElementType }>;
  activeId: string;
  setActiveId: React.Dispatch<React.SetStateAction<string>>;
  environmentId: string;
  survey: TSurvey;
  email: string;
  surveyUrl: string;
  publicDomain: string;
  setSurveyUrl: React.Dispatch<React.SetStateAction<string>>;
  locale: TUserLocale;
  segments: TSegment[];
  isContactsEnabled: boolean;
  isFormbricksCloud: boolean;
}

export const ShareView = ({
  tabs,
  activeId,
  setActiveId,
  environmentId,
  survey,
  email,
  surveyUrl,
  publicDomain,
  setSurveyUrl,
  locale,
  segments,
  isContactsEnabled,
  isFormbricksCloud,
}: ShareViewProps) => {
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const { t } = useTranslate();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();

    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const renderActiveTab = () => {
    switch (activeId) {
      case "email":
        return <EmailTab surveyId={survey.id} email={email} />;
      case "website-embed":
        return (
          <TabContainer
            title={t("environments.surveys.share.embed_on_website.title")}
            description={t("environments.surveys.share.embed_on_website.description")}>
            <WebsiteEmbedTab surveyUrl={surveyUrl} />
          </TabContainer>
        );
      case "dynamic-popup":
        return (
          <TabContainer
            title={t("environments.surveys.share.dynamic_popup.title")}
            description={t("environments.surveys.share.dynamic_popup.description")}>
            <DynamicPopupTab environmentId={environmentId} surveyId={survey.id} />
          </TabContainer>
        );
      case "link":
        return (
          <LinkTab
            survey={survey}
            surveyUrl={surveyUrl}
            publicDomain={publicDomain}
            setSurveyUrl={setSurveyUrl}
            locale={locale}
          />
        );
      case "app":
        return <AppTab />;
      case "personal-links":
        return (
          <PersonalLinksTab
            segments={segments}
            surveyId={survey.id}
            environmentId={environmentId}
            isContactsEnabled={isContactsEnabled}
            isFormbricksCloud={isFormbricksCloud}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full">
      <div className={`flex h-full ${survey.type === "link" ? "lg:grid lg:grid-cols-4" : ""}`}>
        {survey.type === "link" && (
          <SidebarProvider
            open={isLargeScreen}
            className="flex min-h-0 w-auto lg:col-span-1"
            style={
              {
                "--sidebar-width": "100%",
              } as React.CSSProperties
            }>
            <Sidebar className="relative h-full p-0" variant="inset" collapsible="icon">
              <SidebarContent className="h-full border-r border-slate-200 bg-white p-4">
                <SidebarGroup className="p-0">
                  <SidebarGroupLabel>
                    <Small className="text-xs text-slate-500">Share via</Small>
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="flex flex-col gap-1">
                      {tabs.map((tab) => (
                        <SidebarMenuItem key={tab.id}>
                          <SidebarMenuButton
                            onClick={() => setActiveId(tab.id)}
                            className={cn(
                              "flex w-full justify-start rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                              tab.id === activeId
                                ? "bg-slate-100 font-medium text-slate-900"
                                : "text-slate-700"
                            )}
                            tooltip={tab.label}
                            isActive={tab.id === activeId}>
                            <tab.icon className="h-4 w-4 text-slate-700" />
                            <span>{tab.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </SidebarProvider>
        )}
        <div
          className={`h-full w-full grow overflow-y-auto bg-slate-50 px-4 py-6 lg:p-6 ${survey.type === "link" ? "lg:col-span-3" : ""}`}>
          {renderActiveTab()}
          <div className="flex justify-center gap-2 rounded-md pt-6 text-center md:hidden">
            {tabs.map((tab) => (
              <TooltipRenderer tooltipContent={tab.label} key={tab.id}>
                <Button
                  variant="ghost"
                  onClick={() => setActiveId(tab.id)}
                  className={cn(
                    "rounded-md px-4 py-2",
                    tab.id === activeId
                      ? "bg-white text-slate-900 shadow-sm hover:bg-white"
                      : "border-transparent text-slate-700 hover:text-slate-900"
                  )}>
                  <tab.icon className="h-4 w-4 text-slate-700" />
                </Button>
              </TooltipRenderer>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
