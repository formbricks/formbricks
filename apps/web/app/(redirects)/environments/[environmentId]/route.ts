import { notFound, redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { getSession } from "@/modules/auth/lib/session";

export const GET = async (_: Request, context: { params: Promise<{ environmentId: string }> }) => {
  const params = await context?.params;
  const { environmentId } = params;
  if (!environmentId) return notFound();

  // check auth
  const session = await getSession();
  if (!session) throw new AuthenticationError("Not authenticated");

  const workspace = await findWorkspaceByIdOrLegacyEnvId(environmentId);
  if (!workspace) return notFound();

  const hasAccess = await hasUserWorkspaceAccess(session.user.id, workspace.id);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");

  return redirect(`/workspaces/${workspace.id}/`);
};
