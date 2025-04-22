import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectsByOrganizationId } from "@/modules/organization/settings/api-keys/lib/projects";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const locale = await findMatchingLocale();

  const { currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  const projects = await getProjectsByOrganizationId(organization.id);

  const isNotOwner = currentUserMembership.role !== "owner";

  if (isNotOwner) throw new Error(t("common.not_authorized"));

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="api-keys"
        />
      </PageHeader>
      <SettingsCard
        title={t("common.api_keys")}
        description={t("environments.settings.api_keys.api_keys_description")}>
        <ApiKeyList
          organizationId={organization.id}
          locale={locale}
          isReadOnly={isNotOwner}
          projects={projects}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};
