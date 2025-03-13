"use client";

import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslate } from "@tolgee/react";

export const GeneralSettingsLoading = () => {
  const { t } = useTranslate();
  const cards = [
    {
      title: t("common.project_name"),
      description: t("environments.project.general.project_name_settings_description"),
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: t("environments.project.general.recontact_waiting_time"),
      description: t("environments.project.general.recontact_waiting_time_settings_description"),
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: t("environments.project.general.delete_project"),
      description: t("environments.project.general.delete_project_settings_description"),
      skeletonLines: [{ classes: "h-4 w-96" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation activeId="general" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};
