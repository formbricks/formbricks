import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { hasOrganizationAccess } from "@/lib/auth";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const GET = async (_: Request, context: { params: Promise<{ organizationId: string }> }) => {
  const params = await context?.params;
  const organizationId = params?.organizationId;
  if (!organizationId) return notFound();
  // check auth
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");
  const hasAccess = await hasOrganizationAccess(session.user.id, organizationId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organizationId);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  // redirect to first workspace
  const workspaces = await getUserWorkspaces(session.user.id, organizationId);
  if (workspaces.length === 0) {
    return redirect(`/organizations/${organizationId}/landing`);
  }

  const firstWorkspace = workspaces[0];

  if (isBilling) {
    return redirect(`/organizations/${organizationId}/settings/billing`);
  }

  return redirect(`/workspaces/${firstWorkspace.id}/`);
};
