import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { hasOrganizationAccess } from "@/lib/auth";
import { getEnvironments } from "@/lib/environment/service";
import { getWorkspace } from "@/lib/workspace/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const GET = async (_: Request, context: { params: Promise<{ workspaceId: string }> }) => {
  const params = await context?.params;
  const workspaceId = params.workspaceId;
  if (!workspaceId) return notFound();
  // check auth
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) return notFound();
  const hasAccess = await hasOrganizationAccess(session.user.id, workspace.organizationId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");
  // redirect to workspace's production environment
  const environments = await getEnvironments(workspace.id);
  const prodEnvironment = environments.find((e) => e.type === "production");
  if (!prodEnvironment) return notFound();
  return redirect(`/environments/${prodEnvironment.id}/`);
};
