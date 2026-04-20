import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { DEFAULT_LOCALE, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectsByOrganizationId } from "@/modules/organization/settings/api-keys/lib/projects";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { currentUserMembership, organization, session } = await getEnvironmentAuth(params.environmentId);

  const [projects, locale] = await Promise.all([
    getProjectsByOrganizationId(organization.id),
    getUserLocale(session.user.id),
  ]);

  const canAccessApiKeys = currentUserMembership.role === "owner" || currentUserMembership.role === "manager";

  if (!canAccessApiKeys) throw new Error(t("common.not_authorized"));

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
          locale={locale ?? DEFAULT_LOCALE}
          isReadOnly={!canAccessApiKeys}
          projects={projects}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};
