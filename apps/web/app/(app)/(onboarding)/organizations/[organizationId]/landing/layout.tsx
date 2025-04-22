import { getEnvironments } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getUserProjects } from "@/lib/project/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

const LandingLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, params.organizationId);

  if (!membership) {
    return notFound();
  }

  const projects = await getUserProjects(session.user.id, params.organizationId);

  if (projects.length !== 0) {
    const firstProject = projects[0];
    const environments = await getEnvironments(firstProject.id);
    const prodEnvironment = environments.find((e) => e.type === "production");

    if (prodEnvironment) {
      return redirect(`/environments/${prodEnvironment.id}/`);
    }
  }

  return <>{children}</>;
};

export default LandingLayout;
