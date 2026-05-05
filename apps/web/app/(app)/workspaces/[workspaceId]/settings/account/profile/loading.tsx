"use client";

import { useTranslation } from "react-i18next";
import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Loading = () => {
  const { t } = useTranslation();
  const cards = [
    {
      title: t("workspace.settings.profile.personal_information"),
      description: t("workspace.settings.profile.update_personal_info"),
      skeletonLines: [
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
      ],
    },
    {
      title: t("workspace.settings.profile.delete_account"),
      description: t("workspace.settings.profile.confirm_delete_account"),
      skeletonLines: [{ classes: "h-4 w-60" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.profile")} />
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
