import { MembersInfo } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/components/EditMemberships/MembersInfo";
import { getMembersByOrganizationId } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/lib/membership";
import { getRoleManagementPermission } from "@formbricks/ee/lib/service";
import { getInvitesByOrganizationId } from "@formbricks/lib/invite/service";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

type EditMembershipsProps = {
  organization: TOrganization;
  currentUserId: string;
  currentUserMembership: TMembership;
  allMemberships: TMembership[];
};

export const EditMemberships = async ({
  organization,
  currentUserId,
  currentUserMembership: membership,
}: EditMembershipsProps) => {
  const members = await getMembersByOrganizationId(organization.id);
  const invites = await getInvitesByOrganizationId(organization.id);

  const currentUserRole = membership?.organizationRole;
  const isUserManagerOrOwner =
    membership?.organizationRole === "manager" || membership?.organizationRole === "owner";
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-5">Fullname</div>
          <div className="col-span-5">Email</div>
          {canDoRoleManagement && <div className="col-span-5">Role</div>}
          <div className="col-span-5"></div>
        </div>

        {currentUserRole && (
          <MembersInfo
            organization={organization}
            currentUserId={currentUserId}
            invites={invites ?? []}
            members={members ?? []}
            isUserManagerOrOwner={isUserManagerOrOwner}
            currentUserRole={currentUserRole}
            canDoRoleManagement={canDoRoleManagement}
          />
        )}
      </div>
    </div>
  );
};
