import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getEnvironment } from "@/lib/environment/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const GET = async (
  _: Request,
  context: { params: Promise<{ environmentId: string; path: string[] }> }
) => {
  const params = await context?.params;
  const { environmentId, path } = params;
  if (!environmentId) return notFound();

  // check auth
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not authenticated");

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!hasAccess) throw new AuthorizationError("Unauthorized");

  const environment = await getEnvironment(environmentId);
  if (!environment) return notFound();

  return redirect(`/workspaces/${environment.workspaceId}/${path.join("/")}`);
};
