import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";

const ConfigLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const [organization, session] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
  ]);

  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    return redirect(getBillingFallbackPath(params.environmentId, IS_FORMBRICKS_CLOUD));
  }

  const project = await getProjectByEnvironmentId(params.environmentId);
  if (!project) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  return children;
};

export default ConfigLayout;
