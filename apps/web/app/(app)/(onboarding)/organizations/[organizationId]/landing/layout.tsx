import { notFound, redirect } from "next/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
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

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, params.organizationId);

  if (!membership) {
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
