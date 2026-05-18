"use client";

import { useTranslation } from "react-i18next";
import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Loading = () => {
  const { t } = useTranslation();
  const cards = [
    {
      title: t("workspace.settings.notifications.email_alerts_surveys"),
      description: t("workspace.settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses"),
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-10 w-128" }, { classes: "h-10 w-128" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.notifications")} />
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
