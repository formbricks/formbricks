"use client";

import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslate } from "@tolgee/react";

export const AppConnectionLoading = () => {
  const { t } = useTranslate();
  const cards = [
    {
      title: t("environments.project.app-connection.app_connection"),
      description: t("environments.project.app-connection.app_connection_description"),
      skeletonLines: [{ classes: " h-44 max-w-full rounded-lg" }],
    },
    {
      title: t("environments.project.app-connection.how_to_setup"),
      description: t("environments.project.app-connection.how_to_setup_description"),
      skeletonLines: [
        { classes: "h-12 w-24 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
        { classes: "h-12 w-24 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
      ],
    },
    {
      title: t("environments.project.app-connection.environment_id"),
      description: t("environments.project.app-connection.environment_id_description"),
      skeletonLines: [{ classes: "h-12 w-4/6 rounded-lg" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation activeId="app-connection" loading />
      </PageHeader>
      <div className="mt-4 flex max-w-4xl animate-pulse items-center space-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base"></div>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};
