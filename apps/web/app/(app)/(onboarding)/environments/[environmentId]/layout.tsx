import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AuthorizationError } from "@formbricks/types/errors";

const OnboardingLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!isAuthorized) {
    throw new AuthorizationError("User is not authorized to access this environment");
  }

  return <div className="flex-1 bg-slate-50">{children}</div>;
};

export default OnboardingLayout;
