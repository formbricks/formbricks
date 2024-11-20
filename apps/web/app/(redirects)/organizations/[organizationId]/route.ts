import { hasOrganizationAccess } from "@/app/lib/api/apiHelper";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getUserProjects } from "@formbricks/lib/project/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";

export const GET = async (_: Request, context: { params: Promise<{ organizationId: string }> }) => {
  const params = await context?.params;
  const organizationId = params?.organizationId;
  if (!organizationId) return notFound();
  // check auth
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");
  const hasAccess = await hasOrganizationAccess(session.user, organizationId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organizationId);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  // redirect to first product's production environment
  const products = await getUserProjects(session.user.id, organizationId);
  if (products.length === 0) {
    return redirect(`/organizations/${organizationId}/landing`);
  }

  const firstProduct = products[0];
  const environments = await getEnvironments(firstProduct.id);
  const prodEnvironment = environments.find((e) => e.type === "production");
  if (!prodEnvironment) return notFound();

  if (isBilling) {
    return redirect(`/environments/${prodEnvironment.id}/settings/billing`);
  }

  redirect(`/environments/${prodEnvironment.id}/`);
};
