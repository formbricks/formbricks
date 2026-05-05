"use client";

import { useTranslation } from "react-i18next";
import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const UserActionsLoading = () => {
  const { t } = useTranslation();
  const cards = [
    {
      title: t("common.actions"),
      description: t("common.actions_description"),
      skeletonLines: [{ classes: "h-44 max-w-full rounded-lg" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.user_actions")} />
      {cards.map((card) => (
        <LoadingCard key={card.title} {...card} />
      ))}
    </PageContentWrapper>
  );
};
