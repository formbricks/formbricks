"use client";

import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslations } from "next-intl";

const Loading = async () => {
  const t = useTranslations();
  const cards = [
    {
      title: t("environments.product.app-connection.app_connection"),
      description: t("environments.product.app-connection.app_connection_description"),
      skeletonLines: [{ classes: " h-44 max-w-full rounded-lg" }],
    },
    {
      title: t("environments.product.app-connection.how_to_setup"),
      description: t("environments.product.app-connection.how_to_setup_description"),
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
      title: t("environments.product.app-connection.environment_id"),
      description: t("environments.product.app-connection.environment_id_description"),
      skeletonLines: [{ classes: "h-12 w-4/6 rounded-lg" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProductConfigNavigation activeId="app-connection" loading />
      </PageHeader>
      <div className="mt-4 flex max-w-4xl animate-pulse items-center space-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base"></div>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
