import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { hasOrganizationAccess } from "@formbricks/lib/auth";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getProject } from "@formbricks/lib/project/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";

export const GET = async (_: Request, context: { params: Promise<{ projectId: string }> }) => {
  try {
    const params = await context?.params;
    const projectId = params?.projectId;
    if (!projectId) return notFound();

    // check auth
    const session = await getServerSession(authOptions);
    if (!session) throw new AuthenticationError("Not authenticated");

    const project = await getProject(projectId);
    if (!project) return notFound();

    const hasAccess = await hasOrganizationAccess(session.user.id, project.organizationId);
    if (!hasAccess) throw new AuthorizationError("Unauthorized");

    // redirect to project's production environment
    let environments = [];
    try {
      environments = (await getEnvironments(project.id)) || [];
    } catch (error) {
      console.error("Error fetching environments:", error);
      return notFound();
    }

    if (!environments || environments.length === 0) return notFound();

    const prodEnvironment = environments.find((e) => e.type === "production");
    if (!prodEnvironment) return notFound();

    return redirect(`/environments/${prodEnvironment.id}/`);
  } catch (error) {
    console.error("Error in project redirect route:", error);
    return notFound();
  }
};
