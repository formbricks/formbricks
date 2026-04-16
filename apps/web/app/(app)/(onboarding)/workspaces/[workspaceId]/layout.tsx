import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AuthorizationError } from "@formbricks/types/errors";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";

const OnboardingLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const isAuthorized = await hasUserWorkspaceAccess(session.user.id, params.workspaceId);
  if (!isAuthorized) {
    throw new AuthorizationError("User is not authorized to access this workspace");
  }

  return <div className="flex-1 bg-slate-50">{children}</div>;
};

export default OnboardingLayout;
