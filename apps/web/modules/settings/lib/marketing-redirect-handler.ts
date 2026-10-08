import "server-only";
import { redirect } from "next/navigation";
import { WEBAPP_URL } from "@/lib/constants";
import { getSession } from "@/modules/auth/lib/session";
import { getActiveOrganizationIdForUser } from "@/modules/settings/lib/active-organization";
import { getMarketingRedirectTarget } from "@/modules/settings/lib/marketing-redirects";

/**
 * Shared GET handler for the ID-free marketing links in app/(redirects)/: resolves the organization the
 * user is currently in and redirects to `buildPath(organizationId)` (see `getMarketingRedirectTarget`).
 */
export const handleMarketingRedirect = async (
  request: Request,
  buildPath: (organizationId: string) => string
): Promise<never> => {
  const session = await getSession();
  const organizationId = session?.user ? await getActiveOrganizationIdForUser(session.user.id) : undefined;

  return redirect(
    getMarketingRedirectTarget({
      isAuthenticated: Boolean(session?.user),
      organizationId,
      url: new URL(request.url),
      webAppUrl: WEBAPP_URL,
      buildPath,
    })
  );
};
