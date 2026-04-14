import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization } from "@/lib/organization/service";
import { getOrganizationWorkspacesCount } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";

const OnboardingLayout = async (props: {
  params: Promise<{ organizationId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;
  const t = await getTranslate();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, params.organizationId);
  const { isMember, isBilling } = getAccessFlags(membership?.role);
  if (isMember || isBilling) return notFound();

  const organization = await getOrganization(params.organizationId);
  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), params.organizationId);
  }

  const [organizationWorkspacesLimit, organizationWorkspacesCount] = await Promise.all([
    getOrganizationWorkspacesLimit(organization.id),
    getOrganizationWorkspacesCount(organization.id),
  ]);

  if (organizationWorkspacesCount >= organizationWorkspacesLimit) {
    return redirect(`/`);
  }

  return <>{children}</>;
};

export default OnboardingLayout;
