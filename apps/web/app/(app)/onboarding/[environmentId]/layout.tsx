import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { AuthorizationError } from "@formbricks/types/errors";

const OnboardingLayout = async ({ children, params }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }
  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError("Not authorized");
  }

  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  return <>{children}</>;
};

export default OnboardingLayout;
