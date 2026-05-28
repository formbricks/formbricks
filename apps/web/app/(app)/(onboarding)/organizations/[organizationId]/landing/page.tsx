import { notFound, redirect } from "next/navigation";
import { LandingSidebar } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/landing-sidebar";
import { WorkspaceAndOrgSwitch } from "@/app/(app)/workspaces/[workspaceId]/components/workspace-and-org-switch";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Header } from "@/modules/ui/components/header";

const Page = async (props: { params: Promise<{ organizationId: string }> }) => {
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
  const isMembershipPending = membership?.role === undefined;

  return (
    <div className="flex min-h-full min-w-full flex-row">
      <LandingSidebar user={user} organization={organization} isMultiOrgEnabled={isMultiOrgEnabled} />
      <div className="flex-1">
        <div className="flex h-full flex-col">
          <div className="p-6">
            {/* we only need to render organization breadcrumb on this page, organizations/workspaces are lazy-loaded */}
            <WorkspaceAndOrgSwitch
              currentOrganizationId={organization.id}
              currentOrganizationName={organization.name}
              isMultiOrgEnabled={isMultiOrgEnabled}
              organizationWorkspacesLimit={0}
              isFormbricksCloud={IS_FORMBRICKS_CLOUD}
              isLicenseActive={false}
              isOwnerOrManager={false}
              isAccessControlAllowed={false}
              isMembershipPending={isMembershipPending}
            />
          </div>
          <div className="flex h-full flex-col items-center justify-center gap-y-12">
            <Header
              title={t("organizations.landing.no_workspaces_warning_title")}
              subtitle={t("organizations.landing.no_workspaces_warning_subtitle")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
