"use client";

import { useTranslation } from "react-i18next";
import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const GeneralSettingsLoading = () => {
  const { t } = useTranslation();
  const cards = [
    {
      title: t("common.workspace_name"),
      description: t("workspace.general.workspace_name_settings_description"),
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: t("workspace.general.recontact_waiting_time"),
      description: t("workspace.general.recontact_waiting_time_settings_description"),
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: t("workspace.general.delete_workspace"),
      description: t("workspace.general.delete_workspace_settings_description"),
      skeletonLines: [{ classes: "h-4 w-96" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_settings")} />
      {cards.map((card) => (
        <LoadingCard key={card.title} {...card} />
      ))}
    </PageContentWrapper>
  );
};
