import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AuthorizationError } from "@formbricks/types/errors";

const ConfigLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
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
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const project = await getProjectByEnvironmentId(params.environmentId);
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  return children;
};

export default ConfigLayout;
