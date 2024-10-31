import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { ErrorComponent } from "@formbricks/ui/components/ErrorComponent";

export const metadata: Metadata = {
  title: "Billing",
};

const BillingLayout = async ({ children, params }) => {
  const t = await getTranslations();
  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!session) {
    throw new Error(t("common.not_authorized"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isOwner, isAdmin } = getAccessFlags(currentUserMembership?.role);

  return <>{isOwner || isAdmin ? <>{children}</> : <ErrorComponent />}</>;
};

export default BillingLayout;
