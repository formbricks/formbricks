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
      title: t("environments.settings.profile.personal_information"),
      description: t("environments.settings.profile.update_personal_info"),
      skeletonLines: [
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
        { classes: "h-4 w-28" },
        { classes: "h-6 w-64" },
      ],
    },
    {
      title: t("common.avatar"),
      description: t("environments.settings.profile.organization_identification"),
      skeletonLines: [{ classes: "h-10 w-10" }, { classes: "h-8 w-24" }],
    },
    {
      title: t("environments.settings.profile.delete_account"),
      description: t("environments.settings.profile.confirm_delete_account"),
      skeletonLines: [{ classes: "h-4 w-60" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.account_settings")}>
        <AccountSettingsNavbar activeId="profile" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
