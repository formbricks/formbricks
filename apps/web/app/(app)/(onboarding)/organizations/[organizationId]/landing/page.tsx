import { notFound, redirect } from "next/navigation";
import { LandingSidebar } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/landing-sidebar";
import { ProjectAndOrgSwitch } from "@/app/(app)/environments/[environmentId]/components/project-and-org-switch";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Header } from "@/modules/ui/components/header";

const Page = async (props) => {
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
  const { isMember } = getAccessFlags(membership?.role);

  return (
    <div className="flex min-h-full min-w-full flex-row">
      <LandingSidebar user={user} organization={organization} />
      <div className="flex-1">
        <div className="flex h-full flex-col">
          <div className="p-6">
            {/* we only need to render organization breadcrumb on this page, organizations/projects are lazy-loaded */}
            <ProjectAndOrgSwitch
              currentOrganizationId={organization.id}
              currentOrganizationName={organization.name}
              isMultiOrgEnabled={isMultiOrgEnabled}
              organizationProjectsLimit={0}
              isFormbricksCloud={IS_FORMBRICKS_CLOUD}
              isLicenseActive={false}
              isOwnerOrManager={false}
              isAccessControlAllowed={false}
              isMember={isMember}
              environments={[]}
            />
          </div>
          <div className="flex h-full flex-col items-center justify-center space-y-12">
            <Header
              title={t("organizations.landing.no_projects_warning_title")}
              subtitle={t("organizations.landing.no_projects_warning_subtitle")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
