import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { canUserAccessOrganization } from "@formbricks/lib/organization/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { ToasterClient } from "@formbricks/ui/ToasterClient";

const OnboardingLayout = async ({ children, params }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const isAuthorized = await canUserAccessOrganization(session.user.id, params.organizationId);
  if (!isAuthorized) {
    throw AuthorizationError;
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, params.organizationId);
  if (!membership || membership.role === "viewer") return notFound();

  return (
    <div className="flex-1 bg-slate-50">
      <ToasterClient />
      {children}
    </div>
  );
};

export default OnboardingLayout;
