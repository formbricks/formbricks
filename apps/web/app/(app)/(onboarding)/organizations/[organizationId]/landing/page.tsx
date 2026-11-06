import { notFound, redirect } from "next/navigation";
import { CreateFirstWorkspaceButton } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/create-first-workspace-button";
import { OrganizationLandingLayout } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/organization-landing-layout";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Header } from "@/modules/ui/components/header";

const Page = async (props: { readonly params: Promise<{ organizationId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, organization } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) return notFound();

  const isMultiOrgEnabled = await getIsMultiOrgEnabled();

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  const { isOwner, isManager } = getAccessFlags(membership?.role);
  const isOwnerOrManager = isOwner || isManager;
  const isAccessControlAllowed = isOwnerOrManager ? await getAccessControlPermission(organization.id) : false;

  return (
    <OrganizationLandingLayout
      user={user}
      organization={organization}
      isMultiOrgEnabled={isMultiOrgEnabled}
      membershipRole={membership?.role}>
      <div className="flex h-full flex-col items-center justify-center gap-y-12">
        <Header
          title={t("organizations.landing.no_workspaces_warning_title")}
          subtitle={t("organizations.landing.no_workspaces_warning_subtitle")}
        />
        {isOwnerOrManager && (
          <CreateFirstWorkspaceButton
            organizationId={organization.id}
            isAccessControlAllowed={isAccessControlAllowed}
          />
        )}
      </div>
    </OrganizationLandingLayout>
  );
};

export default Page;
