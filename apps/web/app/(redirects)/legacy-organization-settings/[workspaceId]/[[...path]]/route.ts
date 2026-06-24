import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
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

  const session = await getServerSession(authOptions);
  if (!session) return redirect("/auth/login");

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) return notFound();

  const slug = path?.join("/") ?? "";
  // Destination layout enforces org membership, so no authz check is needed here.
  return redirect(organizationSettingsPath(workspace.organizationId, slug));
};
