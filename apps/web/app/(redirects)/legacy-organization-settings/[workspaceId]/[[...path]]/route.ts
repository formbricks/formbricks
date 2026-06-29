import { notFound, redirect } from "next/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

// Back-compat shim for the old workspace-scoped org settings URLs
// (/workspaces/[workspaceId]/settings/organization/*), which next.config.mjs rewrites here. A static
// redirect can't map workspaceId -> organizationId, so we resolve it server-side and forward to the
// new org-scoped route. Bookmarks and in-flight Stripe cancel_urls created before the move keep working.
export const GET = async (
  _: Request,
  context: { params: Promise<{ workspaceId: string; path?: string[] }> }
) => {
  const { workspaceId, path } = await context.params;

  const session = await getSession();
  if (!session?.user) return redirect("/auth/login");

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) return notFound();

  // Resolve workspaceId -> organizationId only for org members. Non-members get the same notFound()
  // the old getWorkspaceAuth page returned, so the redirect never leaks the organizationId (or the
  // workspace's existence) to a user who has no access at the destination anyway.
  const membership = await getMembershipByUserIdOrganizationId(session.user.id, workspace.organizationId);
  if (!membership) return notFound();

  const slug = path?.join("/") ?? "";
  return redirect(organizationSettingsPath(workspace.organizationId, slug));
};
