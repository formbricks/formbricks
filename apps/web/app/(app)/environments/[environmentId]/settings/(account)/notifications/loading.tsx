import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { useTranslations } from "next-intl";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = () => {
  const t = useTranslations();
  const cards = [
    {
      title: t("settings.notifications.email_alerts_surveys"),
      description: t("settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses"),
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-10 w-128" }, { classes: "h-10 w-128" }],
    },
    {
      title: t("settings.notifications.weekly_summary_products"),
      description: t("settings.notifications.stay_up_to_date_with_a_Weekly_every_Monday"),
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
