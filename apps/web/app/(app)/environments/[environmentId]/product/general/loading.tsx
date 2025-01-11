"use client";

import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslations } from "next-intl";

const Loading = () => {
  const t = useTranslations();
  const cards = [
    {
      title: t("common.product_name"),
      description: t("environments.product.general.product_name_settings_description"),
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: t("environments.product.general.recontact_waiting_time"),
      description: t("environments.product.general.recontact_waiting_time_settings_description"),
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Edit Default Reward",
      description: "Change the default reward for completing a survey.",
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Callback and Redirect URLs",
      description: "Define the default redirect and callback url",
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: t("environments.product.general.delete_product"),
      description: t("environments.product.general.delete_product_settings_description"),
      skeletonLines: [{ classes: "h-4 w-96" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProductConfigNavigation activeId="general" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
