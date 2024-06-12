import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { OrganizationActions } from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/components/EditMemberships/OrganizationActions";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { getIsMultiOrgEnabled, getRoleManagementPermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { INVITE_DISABLED, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import {
  getMembershipByUserIdOrganizationId,
  getMembershipsByUserId,
} from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { SettingsId } from "@formbricks/ui/SettingsId";
import { SettingsCard } from "../../components/SettingsCard";
import { DeleteOrganization } from "./components/DeleteOrganization";
import { EditMemberships } from "./components/EditMemberships";
import { EditOrganizationNameForm } from "./components/EditOrganizationNameForm";

const MembersLoading = () => (
  <div className="px-2">
    {Array.from(Array(2)).map((_, index) => (
      <div key={index} className="mt-4">
        <div className={`h-8 w-80 animate-pulse rounded-full bg-slate-200`} />
      </div>
    ))}
  </div>
);

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthenticated");
  }
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isOwner, isAdmin } = getAccessFlags(currentUserMembership?.role);
  const userMemberships = await getMembershipsByUserId(session.user.id);
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();

  const isDeleteDisabled = !isOwner || !isMultiOrgEnabled;
  const currentUserRole = currentUserMembership?.role;

  const isLeaveOrganizationDisabled = userMemberships.length <= 1;
  const isUserAdminOrOwner = isAdmin || isOwner;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Organization Settings">
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="members"
        />
      </PageHeader>
      <SettingsCard title="Manage members" description="Add or remove members in your organization.">
        {currentUserRole && (
          <OrganizationActions
            organization={organization}
            isAdminOrOwner={isUserAdminOrOwner}
            role={currentUserRole}
            isLeaveOrganizationDisabled={isLeaveOrganizationDisabled}
            isInviteDisabled={INVITE_DISABLED}
            canDoRoleManagement={canDoRoleManagement}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            environmentId={params.environmentId}
            isMultiOrgEnabled={isMultiOrgEnabled}
          />
        )}

        {currentUserMembership && (
          <Suspense fallback={<MembersLoading />}>
            <EditMemberships
              organization={organization}
              currentUserId={session.user?.id}
              allMemberships={userMemberships}
              currentUserMembership={currentUserMembership}
            />
          </Suspense>
        )}
      </SettingsCard>
      <SettingsCard title="Organization Name" description="Give your organization a descriptive name.">
        <EditOrganizationNameForm
          organization={organization}
          environmentId={params.environmentId}
          membershipRole={currentUserMembership?.role}
        />
      </SettingsCard>
      {isMultiOrgEnabled && (
        <SettingsCard
          title="Delete Organization"
          description="Delete organization with all its products including all surveys, responses, people, actions and attributes">
          <DeleteOrganization
            organization={organization}
            isDeleteDisabled={isDeleteDisabled}
            isUserOwner={currentUserRole === "owner"}
            isMultiOrgEnabled={isMultiOrgEnabled}
          />
        </SettingsCard>
      )}

      <SettingsId title="Organization" id={organization.id}></SettingsId>
    </PageContentWrapper>
  );
};

export default Page;
