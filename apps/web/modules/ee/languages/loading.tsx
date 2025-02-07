"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { LanguageLabels } from "@/modules/ee/multi-language-surveys/components/language-labels";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslate } from "@tolgee/react";

export const LanguagesLoading = () => {
  const { t } = useTranslate();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProjectConfigNavigation activeId="languages" loading />
      </PageHeader>
      <SettingsCard
        title={t("environments.project.languages.multi_language_surveys")}
        description={t("environments.project.languages.multi_language_surveys_description")}>
        <div className="flex flex-col space-y-4">
          <LanguageLabels />
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="my-3 grid h-10 grid-cols-4 gap-4">
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
