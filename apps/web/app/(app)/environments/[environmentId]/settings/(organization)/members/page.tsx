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
import { Skeleton } from "@formbricks/ui/Skeleton";

import { SettingsCard } from "../../components/SettingsCard";
import { DeleteOrganization } from "./components/DeleteOrganization";
import { EditMemberships } from "./components/EditMemberships";
import { EditOrganizationName } from "./components/EditOrganizationName";

const MembersLoading = () => (
  <div className="rounded-lg border border-slate-200">
    <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
      <div className="col-span-2"></div>
      <div className="col-span-5">Fullname</div>
      <div className="col-span-5">Email</div>
      <div className="col-span-3">Role</div>
    </div>

    <div className="p-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-white p-4 text-left text-sm font-semibold text-slate-900">
          <Skeleton className="col-span-2 h-10 w-10 rounded-full" />
          <Skeleton className="col-span-5 h-8 w-24" />
          <Skeleton className="col-span-5 h-8 w-24" />
          <Skeleton className="col-span-3 h-8 w-24" />
        </div>
      ))}
    </div>
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
        <EditOrganizationName
          organization={organization}
          environmentId={params.environmentId}
          membershipRole={currentUserMembership?.role}
        />
      </SettingsCard>
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
      <SettingsId title="Organization" id={organization.id}></SettingsId>
    </PageContentWrapper>
  );
};

export default Page;
