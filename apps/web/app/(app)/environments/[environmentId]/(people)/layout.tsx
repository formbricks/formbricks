import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { AuthorizationError } from "@formbricks/types/errors";

const ConfigLayout = async ({ children, params }) => {
  const t = await getTranslations();
  const [organization, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  const { isMember, isBilling } = getAccessFlags(currentUserMembership?.organizationRole);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const product = await getProductByEnvironmentId(params.environmentId);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }
  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  if (isReadOnly) {
    return redirect(`/environments/${params.environmentId}/surveys`);
  }

  return children;
};

export default ConfigLayout;
