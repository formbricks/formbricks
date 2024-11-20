"use client";

import { ProjectConfigNavigation } from "@/app/(app)/environments/[environmentId]/project/components/ProjectConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { LanguageLabels } from "@/modules/ee/multi-language-surveys/components/language-labels";
import { useTranslations } from "next-intl";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = () => {
  const t = useTranslations();
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

export default Loading;