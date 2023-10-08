import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasTeamAccess } from "@/lib/api/apiHelper";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getProducts } from "@formbricks/lib/product/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/v1/errors";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

export async function GET(_: Request, context: { params: { teamId: string } }) {
  const teamId = context?.params?.teamId;
  if (!teamId) return notFound();
  // check auth
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");
  const hasAccess = await hasTeamAccess(session.user, teamId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");
  // redirect to first product's production environment
  const products = await getProducts(teamId);
  if (products.length === 0) return notFound();
  const firstProduct = products[0];
  const environments = await getEnvironments(firstProduct.id);
  const prodEnvironment = environments.find((e) => e.type === "production");
  if (!prodEnvironment) return notFound();
  redirect(`/environments/${prodEnvironment.id}/`);
}
