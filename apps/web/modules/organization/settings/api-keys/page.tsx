import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectsByOrganizationId } from "@/modules/organization/settings/api-keys/lib/projects";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const [session, organization] = await Promise.all([
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const locale = await findMatchingLocale();

  const projects = await getProjectsByOrganizationId(organization.id);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const isReadOnly = isMember;

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
        description={t("environments.settings.api-keys.api_keys_description")}>
        <ApiKeyList
          organizationId={organization.id}
          locale={locale}
          isReadOnly={isReadOnly}
          projects={projects}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default APIKeysPage;
