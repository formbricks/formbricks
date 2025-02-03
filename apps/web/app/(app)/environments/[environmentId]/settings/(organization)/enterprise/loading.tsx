import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

const Loading = async () => {
  const t = await getTranslate();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar isFormbricksCloud={IS_FORMBRICKS_CLOUD} activeId="enterprise" loading />
      </PageHeader>
      <div className="my-8 h-64 animate-pulse rounded-xl bg-slate-200"></div>
      <div className="my-8 h-96 animate-pulse rounded-md bg-slate-200"></div>
    </PageContentWrapper>
  );
};

export default Loading;
