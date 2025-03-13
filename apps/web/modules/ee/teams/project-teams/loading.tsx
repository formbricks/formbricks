"use client";

import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslate } from "@tolgee/react";

export const TeamsLoading = () => {
  const { t } = useTranslate();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation activeId="teams" loading />
      </PageHeader>
      <div className="p-4">
        <div className="mb-4">
          <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div
              key={idx}
              className="flex animate-pulse items-center space-x-4 rounded border border-slate-200 p-4">
              <div className="h-10 w-10 rounded-full bg-slate-300" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContentWrapper>
  );
};
