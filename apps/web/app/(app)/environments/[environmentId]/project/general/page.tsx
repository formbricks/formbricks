import { ProjectConfigNavigation } from "@/app/(app)/environments/[environmentId]/project/components/ProjectConfigNavigation";
import {
  getMultiLanguagePermission,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import packageJson from "@/package.json";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { SettingsId } from "@formbricks/ui/components/SettingsId";
import { SettingsCard } from "../../settings/components/SettingsCard";
import { DeleteProduct } from "./components/DeleteProject";
import { EditProductNameForm } from "./components/EditProductNameForm";
import { EditWaitingTimeForm } from "./components/EditWaitingTimeForm";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslations();
  const [product, session, organization] = await Promise.all([
    getProjectByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error(t("environments.product.general.product_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const productPermission = await getProjectPermissionByUserId(session.user.id, product.id);

  const { isMember, isOwner, isManager } = getAccessFlags(currentUserMembership?.role);
  const { hasManageAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && !hasManageAccess;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  const isOwnerOrManager = isOwner || isManager;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProjectConfigNavigation
          environmentId={params.environmentId}
          activeId="general"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <SettingsCard
        title={t("common.product_name")}
        description={t("environments.product.general.product_name_settings_description")}>
        <EditProductNameForm product={product} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.product.general.recontact_waiting_time")}
        description={t("environments.product.general.recontact_waiting_time_settings_description")}>
        <EditWaitingTimeForm project={product} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.product.general.delete_product")}
        description={t("environments.product.general.delete_product_settings_description")}>
        <DeleteProduct
          environmentId={params.environmentId}
          product={product}
          isOwnerOrManager={isOwnerOrManager}
        />
      </SettingsCard>
      <div>
        <SettingsId title={t("common.product_id")} id={product.id}></SettingsId>
        {!IS_FORMBRICKS_CLOUD && (
          <SettingsId title={t("common.formbricks_version")} id={packageJson.version}></SettingsId>
        )}
      </div>
    </PageContentWrapper>
  );
};

export default Page;
