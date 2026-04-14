"use client";

import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";

export const TagsLoading = () => {
  const { t } = useTranslation();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation activeId="tags" loading />
      </PageHeader>
      <SettingsCard
        title={t("workspace.tags.manage_tags")}
        description={t("workspace.tags.manage_tags_description")}>
        <div className="w-full">
          <div className="grid grid-cols-4 content-center rounded-lg bg-white text-left text-sm font-semibold text-slate-900">
            <div className="col-span-2">{t("workspace.tags.tag")}</div>
            <div className="col-span-1 text-center">{t("workspace.tags.count")}</div>
            <div className="col-span-1 flex justify-center text-center">{t("common.actions")}</div>
          </div>
          <div className="w-full">
            {[...Array(3)].map((_, idx) => (
              <div key={`tag-skeleton-${idx}`} className="grid h-16 w-full grid-cols-4 content-center">
                <div className="col-span-2 h-10 animate-pulse rounded-md bg-slate-200" />

                <div className="flex items-center justify-center">
                  <div className="h-5 w-5 animate-pulse rounded-md bg-slate-200" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};
