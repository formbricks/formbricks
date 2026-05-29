"use client";

import { useTranslation } from "react-i18next";
import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const AppConnectionLoading = () => {
  const { t } = useTranslation();
  const cards = [
    {
      title: t("workspace.app-connection.sdk_connection_details"),
      description: t("workspace.app-connection.sdk_connection_details_description"),
      skeletonLines: [
        { classes: "h-8 w-72 rounded-lg" },
        { classes: "h-8 w-72 rounded-lg" },
      ],
    },
    {
      title: t("workspace.app-connection.install_code_snippet"),
      description: t("workspace.app-connection.install_code_snippet_description"),
      skeletonLines: [{ classes: "h-40 max-w-full rounded-lg" }],
    },
    {
      title: t("workspace.app-connection.app_connection"),
      description: t("workspace.app-connection.app_connection_description"),
      skeletonLines: [{ classes: " h-44 max-w-full rounded-lg" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.connect_your_app")} />
      <div className="mt-4 flex max-w-4xl animate-pulse items-center gap-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-sm md:gap-y-0 md:text-base"></div>
      {cards.map((card) => (
        <LoadingCard key={card.title} {...card} />
      ))}
    </PageContentWrapper>
  );
};
