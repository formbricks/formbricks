import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getUserProjects } from "@formbricks/lib/project/service";

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

  const products = await getUserProjects(session.user.id, params.organizationId);

  if (products.length !== 0) {
    const firstProduct = products[0];
    const environments = await getEnvironments(firstProduct.id);
    const prodEnvironment = environments.find((e) => e.type === "production");

    if (prodEnvironment) {
      return redirect(`/environments/${prodEnvironment.id}/`);
    }
  }

  return <>{children}</>;
};

export default LandingLayout;
