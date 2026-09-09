import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";

const LandingLayout = async (props: {
  params: Promise<{ organizationId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const session = await getSession();
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  // ENG-2388: was a direct `getMembershipByUserIdOrganizationId` truthiness check. `organization.read`
  // is the same set — the schema grants it to every membership role (owner, manager, member, billing)
  // and to nobody else — so a non-member still gets `notFound()` and every member still passes. Routing
  // it here is what puts the decision on the shadow-comparison path.
  const isMember = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: session.user.id }, "organization.read", {
      type: "organization",
      id: params.organizationId,
    })
  );

  if (!isMember) {
    return notFound();
  }

  const workspaces = await getUserWorkspaces(session.user.id, params.organizationId);

  if (workspaces.length !== 0) {
    const firstWorkspace = workspaces[0];
    return redirect(`/workspaces/${firstWorkspace.id}/`);
  }

  return <>{children}</>;
};

export default LandingLayout;
