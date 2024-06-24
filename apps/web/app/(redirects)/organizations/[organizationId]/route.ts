import { hasOrganizationAccess } from "@/app/lib/api/apiHelper";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getProducts } from "@formbricks/lib/product/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";

export const GET = async (_: Request, context: { params: { organizationId: string } }) => {
  const organizationId = context?.params?.organizationId;
  if (!organizationId) return notFound();
  // check auth
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");
  const hasAccess = await hasOrganizationAccess(session.user, organizationId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");
  // redirect to first product's production environment
  const products = await getProducts(organizationId);
  if (products.length === 0) return notFound();
  const firstProduct = products[0];
  const environments = await getEnvironments(firstProduct.id);
  const prodEnvironment = environments.find((e) => e.type === "production");
  if (!prodEnvironment) return notFound();
  redirect(`/environments/${prodEnvironment.id}/`);
};
