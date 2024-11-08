import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { canUserAccessOrganization } from "@formbricks/lib/organization/auth";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { ToasterClient } from "@formbricks/ui/components/ToasterClient";

const ProductOnboardingLayout = async ({ children, params }) => {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  const isAuthorized = await canUserAccessOrganization(session.user.id, params.organizationId);
  if (!isAuthorized) {
    throw AuthorizationError;
  }

  const organization = await getOrganization(params.organizationId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
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
