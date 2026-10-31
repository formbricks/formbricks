import "server-only";
import { notFound, redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getSession } from "@/modules/auth/lib/session";
import {
  getActiveOrganizationIdForUser,
  getActiveWorkspaceIdForUser,
} from "@/modules/settings/lib/active-organization";
import {
  type TMarketingDestination,
  getMarketingDestination,
  getMarketingRedirectTarget,
} from "@/modules/settings/lib/marketing-redirects";

/**
 * Redirects an ID-free marketing link: resolves the organization
 * (and, for workspace links, the workspace) the user is currently in and redirects to `destination`
 * (see `getMarketingRedirectTarget`).
 */
const handleMarketingRedirect = async (
  request: Request,
  linkPath: string,
  destination: TMarketingDestination
): Promise<never> => {
  const { search } = new URL(request.url);
  const session = await getSession();
  const userId = session?.user?.id;
  // The proxy already sends logged-out visitors to login with this link as callbackUrl; this only
  // catches a session that expired in between, and keeps the same callbackUrl (the link as visited,
  // not the rewritten route).
  if (!userId) {
    return redirect(`/auth/login?callbackUrl=${encodeURIComponent(WEBAPP_URL + linkPath + search)}`);
  }

  const organizationId = await getActiveOrganizationIdForUser(userId);
  const workspaceId =
    organizationId && destination.scope === "workspace"
      ? await getActiveWorkspaceIdForUser(userId, organizationId)
      : undefined;
  // Only a workspace link without a workspace needs the role, to send billing members to billing.
  const isBillingMember =
    organizationId && destination.scope === "workspace" && !workspaceId
      ? getAccessFlags((await getMembershipByUserIdOrganizationId(userId, organizationId))?.role).isBilling
      : false;

  return redirect(
    getMarketingRedirectTarget({
      organizationId,
      workspaceId,
      isBillingMember,
      isFormbricksCloud: IS_FORMBRICKS_CLOUD,
      search,
      destination,
    })
  );
};

/** GET handler for `app/(redirects)/marketing-links/[[...path]]`, where the proxy rewrites every link. */
export const marketingLinksRoute = async (
  request: Request,
  context: { params: Promise<{ path?: string[] }> }
): Promise<never> => {
  const { path } = await context.params;
  const destination = getMarketingDestination(path, IS_FORMBRICKS_CLOUD);
  if (!destination) return notFound();
  return handleMarketingRedirect(request, `/${(path ?? []).join("/")}`, destination);
};
