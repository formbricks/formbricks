import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { canUserAccessOrganization } from "@formbricks/lib/organization/auth";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { ToasterClient } from "@formbricks/ui/ToasterClient";

const ProductOnboardingLayout = async ({ children, params }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  const isAuthorized = await canUserAccessOrganization(session.user.id, params.organizationId);
  if (!isAuthorized) {
    throw AuthorizationError;
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, params.organizationId);
  if (!membership || membership.role === "viewer") return notFound();

  const organization = await getOrganization(params.organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  return (
    <div className="flex-1 bg-slate-50">
      <PosthogIdentify
        session={session}
        user={user}
        organizationId={organization.id}
        organizationName={organization.name}
        organizationBilling={organization.billing}
      />
      <ToasterClient />
      {children}
    </div>
  );
};

export default ProductOnboardingLayout;
