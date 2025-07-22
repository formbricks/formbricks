"use client";

import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslate } from "@tolgee/react";

const Loading = () => {
  const { t } = useTranslate();
  const cards = [
    {
      title: t("environments.settings.notifications.email_alerts_surveys"),
      description: t("environments.settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses"),
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-10 w-128" }, { classes: "h-10 w-128" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.account_settings")}>
        <AccountSettingsNavbar activeId="notifications" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
