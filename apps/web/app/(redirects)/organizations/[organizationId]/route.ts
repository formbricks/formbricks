import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { hasOrganizationAccess } from "@/lib/auth";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { appendSearch } from "@/modules/settings/lib/marketing-redirects";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";

export const GET = async (request: Request, context: { params: Promise<{ organizationId: string }> }) => {
  // Keep the query string: ID-free marketing links fall back here and must not lose their UTM params.
  const { search } = new URL(request.url);
  const params = await context?.params;
  const organizationId = params?.organizationId;
  if (!organizationId) return notFound();
  // check auth
  const session = await getSession();
  if (!session) throw new AuthenticationError("Not authenticated");
  const hasAccess = await hasOrganizationAccess(session.user.id, organizationId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organizationId);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  // Billing members cannot open workspaces, so they go to billing before the workspace lookup (a billing
  // member usually has no accessible workspace and would otherwise land on the landing page).
  if (isBilling) {
    return redirect(appendSearch(getOrganizationBillingPath(organizationId, IS_FORMBRICKS_CLOUD), search));
  }

  // redirect to first workspace
  const workspaces = await getUserWorkspaces(session.user.id, organizationId);
  if (workspaces.length === 0) {
    return redirect(appendSearch(`/organizations/${organizationId}/landing`, search));
  }

  return redirect(appendSearch(`/workspaces/${workspaces[0].id}/`, search));
};
