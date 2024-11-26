import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { AuthorizationError } from "@formbricks/types/errors";

const OnboardingLayout = async ({ children, params }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!isAuthorized) {
    throw AuthorizationError;
  }

  return <div className="flex-1 bg-slate-50">{children}</div>;
};

export default OnboardingLayout;
