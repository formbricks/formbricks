import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

const Loading = async () => {
  const t = await getTranslate();

  const cards = [
    {
      title: t("environments.settings.general.organization_name"),
      description: t("environments.settings.general.organization_name_description"),
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
    },
    {
      title: t("environments.settings.general.delete_organization"),
      description: t("environments.settings.general.delete_organization_description"),
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar isFormbricksCloud={IS_FORMBRICKS_CLOUD} activeId="general" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
