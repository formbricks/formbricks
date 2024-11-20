import { ProjectConfigNavigation } from "@/app/(app)/environments/[environmentId]/project/components/ProjectConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import {
  getMultiLanguagePermission,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getTagsOnResponsesCount } from "@formbricks/lib/tagOnResponse/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { EditTagsWrapper } from "./components/EditTagsWrapper";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const [tags, environmentTagsCount, organization, session, product] = await Promise.all([
    getTagsByEnvironmentId(params.environmentId),
    getTagsOnResponsesCount(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getProjectByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProjectPermissionByUserId(session.user.id, product.id);
  const { hasManageAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && !hasManageAccess;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProjectConfigNavigation
          environmentId={params.environmentId}
          activeId="tags"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <SettingsCard
        title={t("environments.product.tags.manage_tags")}
        description={t("environments.product.tags.manage_tags_description")}>
        <EditTagsWrapper
          environment={environment}
          environmentTags={tags}
          environmentTagsCount={environmentTagsCount}
          isReadOnly={isReadOnly}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
