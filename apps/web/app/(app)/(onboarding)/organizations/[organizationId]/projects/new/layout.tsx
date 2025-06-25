import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization } from "@/lib/organization/service";
import { getOrganizationProjectsCount } from "@/lib/project/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getOrganizationProjectsLimit } from "@/modules/ee/license-check/lib/utils";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

const OnboardingLayout = async (props) => {
  const params = await props.params;

  const { children } = props;
  const t = await getTranslate();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, params.organizationId);
  const { isMember, isBilling } = getAccessFlags(membership?.role);
  if (isMember || isBilling) return notFound();

  const organization = await getOrganization(params.organizationId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const organizationProjectsLimit = await getOrganizationProjectsLimit(organization.billing.limits);
  const organizationProjectsCount = await getOrganizationProjectsCount(organization.id);

  if (organizationProjectsCount >= organizationProjectsLimit) {
    return redirect(`/`);
  }

  return <>{children}</>;
};

export default OnboardingLayout;
