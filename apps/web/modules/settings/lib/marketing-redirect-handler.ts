import "server-only";
import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@/lib/constants";
import { getSession } from "@/modules/auth/lib/session";
import {
  getActiveOrganizationIdForUser,
  getActiveWorkspaceIdForUser,
} from "@/modules/settings/lib/active-organization";
import {
  type TMarketingDestination,
  type TMarketingSectionSlug,
  getMarketingRedirectTarget,
  getSectionDestination,
} from "@/modules/settings/lib/marketing-redirects";

/**
 * Shared GET handler for the ID-free marketing links in app/(redirects)/: resolves the organization
 * (and, for workspace links, the workspace) the user is currently in and redirects to `destination`
 * (see `getMarketingRedirectTarget`).
 */
export const handleMarketingRedirect = async (
  request: Request,
  destination: TMarketingDestination
): Promise<never> => {
  const session = await getSession();
  const userId = session?.user?.id;
  const organizationId = userId ? await getActiveOrganizationIdForUser(userId) : undefined;
  const workspaceId =
    userId && organizationId && destination.scope === "workspace"
      ? await getActiveWorkspaceIdForUser(userId, organizationId)
      : undefined;

  return redirect(
    getMarketingRedirectTarget({
      isAuthenticated: Boolean(userId),
      organizationId,
      workspaceId,
      url: new URL(request.url),
      webAppUrl: WEBAPP_URL,
      destination,
    })
  );
};

/** GET handler for `app/(redirects)/<section>/[[...path]]/route.ts`, driven by `MARKETING_SECTIONS`. */
export const marketingSectionRoute =
  (slug: TMarketingSectionSlug) =>
  async (request: Request, context: { params: Promise<{ path?: string[] }> }): Promise<never> => {
    const { path } = await context.params;
    return handleMarketingRedirect(request, getSectionDestination(slug, path, IS_FORMBRICKS_CLOUD));
  };
