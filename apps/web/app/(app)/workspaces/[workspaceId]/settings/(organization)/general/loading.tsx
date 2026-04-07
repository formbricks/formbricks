import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { OrganizationSettingsNavbar } from "@/app/(app)/workspaces/[workspaceId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Loading = async () => {
  const t = await getTranslate();

  const cards = [
    {
      title: t("workspace.settings.general.organization_name"),
      description: t("workspace.settings.general.organization_name_description"),
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
    },
    {
      title: t("workspace.settings.general.delete_organization"),
      description: t("workspace.settings.general.delete_organization_description"),
      skeletonLines: [{ classes: "h-6 w-28" }, { classes: "h-8 w-80" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar isFormbricksCloud={IS_FORMBRICKS_CLOUD} activeId="general" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;
