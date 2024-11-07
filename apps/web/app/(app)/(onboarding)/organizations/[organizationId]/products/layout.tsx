import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";

const OnboardingLayout = async ({ children, params }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, params.organizationId);
  const { isMember, isBilling } = getAccessFlags(membership?.role);
  if (isMember || isBilling) return notFound();

  return <>{children}</>;
};

export default OnboardingLayout;
