"use client";

import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/tab-container";
import { ShareViewType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/types/share";
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

interface ShareViewProps {
  tabs: Array<{
    id: ShareViewType;
    label: string;
    icon: React.ElementType;
    componentType: React.ComponentType<any>;
    componentProps: any;
    title: string;
    description?: string;
  }>;
  activeId: ShareViewType;
  setActiveId: React.Dispatch<React.SetStateAction<ShareViewType>>;
}

export const ShareView = ({ tabs, activeId, setActiveId }: ShareViewProps) => {
  const { t } = useTranslate();
  const [isLargeScreen, setIsLargeScreen] = useState(true);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();

    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const renderActiveTab = () => {
    const activeTab = tabs.find((tab) => tab.id === activeId);
    if (!activeTab) return null;

    const { componentType: Component, componentProps } = activeTab;

    return (
      <TabContainer key={activeTab.id} title={activeTab.title} description={activeTab.description ?? ""}>
        <Component {...componentProps} />
      </TabContainer>
    );
  };

  return (
    <div className="h-full">
      <div className={`flex h-full lg:grid lg:grid-cols-4`}>
        <SidebarProvider
          open={isLargeScreen}
          className="flex min-h-0 w-auto lg:col-span-1"
          style={
            {
              "--sidebar-width": "100%",
            } as React.CSSProperties
          }>
          <Sidebar className="relative h-full p-0" variant="inset" collapsible="icon">
            <SidebarContent className="h-full rounded-l-lg border-r border-slate-200 bg-white p-4">
              <SidebarGroup className="p-0">
                <SidebarGroupLabel>
                  <Small className="text-xs text-slate-500">
                    {t("environments.surveys.share.share_view_title")}
                  </Small>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="flex flex-col gap-1">
                    {tabs.map((tab) => (
                      <SidebarMenuItem key={tab.id}>
                        <SidebarMenuButton
                          onClick={() => setActiveId(tab.id)}
                          className={cn(
                            "flex w-full justify-start rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                            tab.id === activeId ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"
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
        <div
          className={`h-full w-full grow overflow-y-auto rounded-lg bg-slate-50 px-4 py-6 md:rounded-l-lg lg:col-span-3 lg:p-6`}>
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
