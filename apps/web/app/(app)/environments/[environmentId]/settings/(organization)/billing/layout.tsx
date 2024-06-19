import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

export const metadata: Metadata = {
  title: "Billing",
};

const BillingLayout = async ({ children, params }) => {
  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isOwner, isAdmin } = getAccessFlags(currentUserMembership?.role);

  return <>{isOwner || isAdmin ? <>{children}</> : <ErrorComponent />}</>;
};

export default BillingLayout;
