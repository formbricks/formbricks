import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectsByOrganizationId } from "@/modules/organization/settings/api-keys/lib/projects";
import { Alert } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const locale = await findMatchingLocale();

  const { currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  const projects = await getProjectsByOrganizationId(organization.id);

  const isNotOwner = currentUserMembership.role !== "owner";

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
      {isNotOwner ? (
        <Alert variant="warning" size={"small"}>
          {t("environments.settings.general.only_org_owner_can_perform_action")}
        </Alert>
      ) : (
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
      )}
    </PageContentWrapper>
  );
};
