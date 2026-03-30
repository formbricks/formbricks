"use client";

import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { LanguageLabels } from "@/modules/survey/multi-language-surveys/components/language-labels";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const LanguagesLoading = () => {
  const { t } = useTranslation();
  const loaderIds: string[] = [
    "6ac6e8d8-1448-49cd-9f7b-0843a1fb2f23",
    "6ac6e8d8-1448-49cd-9f7b-0843a1fb2f24",
    "6ac6e8d8-1448-49cd-9f7b-0843a1fb2f25",
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <ProjectConfigNavigation activeId="languages" loading />
      </PageHeader>
      <SettingsCard
        title={t("environments.workspace.languages.multi_language_surveys")}
        description={t("environments.workspace.languages.multi_language_surveys_description")}>
        <div className="flex flex-col space-y-4">
          <LanguageLabels />
          {loaderIds.map((id) => (
            <div key={id} className="my-3 grid h-10 grid-cols-4 gap-4">
              <div className="h-full animate-pulse rounded-md bg-slate-200" />
              <div className="h-full animate-pulse rounded-md bg-slate-200" />
              <div className="h-full animate-pulse rounded-md bg-slate-200" />
            </div>
          ))}
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};
