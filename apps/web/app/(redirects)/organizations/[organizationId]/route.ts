import { hasOrganizationAccess } from "@/app/lib/api/apiHelper";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getUserProducts } from "@formbricks/lib/product/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";

export const GET = async (_: Request, context: { params: { organizationId: string } }) => {
  const organizationId = context?.params?.organizationId;
  if (!organizationId) return notFound();
  // check auth
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");
  const hasAccess = await hasOrganizationAccess(session.user, organizationId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organizationId);
  const { isBilling } = getAccessFlags(currentUserMembership?.organizationRole);

  if (isBilling) {
    return redirect(`/organizations/${organizationId}/settings/billing`);
  }

  // redirect to first product's production environment
  const products = await getUserProducts(session.user.id, organizationId);
  if (products.length === 0) {
    return redirect(`/organizations/${organizationId}/landing`);
  }

  const firstProduct = products[0];
  const environments = await getEnvironments(firstProduct.id);
  const prodEnvironment = environments.find((e) => e.type === "production");
  if (!prodEnvironment) return notFound();
  redirect(`/environments/${prodEnvironment.id}/`);
};
