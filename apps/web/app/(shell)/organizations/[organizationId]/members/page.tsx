import {
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
  INVITE_DISABLED,
  IS_FORMBRICKS_CLOUD,
  USER_MANAGEMENT_MINIMUM_ROLE,
} from "@/lib/constants";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getTeamsWhereUserIsAdmin } from "@/modules/ee/teams/lib/roles";
import { getMembershipsByUserId } from "@/modules/organization/settings/teams/lib/membership";
import { OrganizationHeader } from "@/modules/shell/components/organization-header";
import { ShellPage } from "@/modules/shell/components/shell-page";
import { InviteMemberDialog } from "@/modules/shell/organization/components/invite-member-dialog";
import { MembersTable } from "@/modules/shell/organization/components/members-table";
import { SectionHeading } from "@/modules/shell/organization/components/section-heading";
import { getMemberDirectory } from "@/modules/shell/organization/lib/member-directory";
import {
  getAssignableRoles,
  getMemberRowAccess,
  hasMoreThanOneActiveOwner,
} from "@/modules/shell/organization/lib/member-rows";
import { requireNonBillingRole } from "@/modules/shell/organization/lib/restricted-section";

const MembersPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await requireNonBillingRole(organizationId);
  const [t, locale] = await Promise.all([getTranslate(), getLocale()]);

  const currentUserId = shell.user.id;
  const currentRole = shell.membership.role;
  const isOwnerOrManager = shell.isOwner || shell.isManager;

  const [directory, isAccessControlAllowed, isMultiOrgEnabled, userMemberships, adminTeamIds] =
    await Promise.all([
      getMemberDirectory(organizationId, isOwnerOrManager),
      getAccessControlPermission(organizationId),
      getIsMultiOrgEnabled(),
      getMembershipsByUserId(currentUserId),
      getTeamsWhereUserIsAdmin(currentUserId, organizationId),
    ]);

  // Owner or manager, as far as USER_MANAGEMENT_MINIMUM_ROLE lets them manage people.
  const canManageUsers = getUserManagementAccess(currentRole, USER_MANAGEMENT_MINIMUM_ROLE);
  // A team admin who is a plain member may invite people into their own teams (licensed only).
  const isTeamAdminRestricted = !isOwnerOrManager && isAccessControlAllowed && adminTeamIds.length > 0;
  const canInvite = !INVITE_DISABLED && (canManageUsers || isTeamAdminRestricted);

  const doesOrgHaveMoreThanOneOwner = hasMoreThanOneActiveOwner(directory.rows);
  const rows = directory.rows.map((row) => ({
    row,
    access: getMemberRowAccess({
      row,
      currentUserId,
      currentRole,
      canManageUsers,
      canEditRoles: isAccessControlAllowed,
      isFormbricksCloud: IS_FORMBRICKS_CLOUD,
      isMultiOrgEnabled,
      hasOtherOrganizations: userMemberships.length > 1,
      doesOrgHaveMoreThanOneOwner,
    }),
  }));

  const memberCount = directory.rows.filter((row) => row.kind === "member").length;
  const inviteCount = directory.rows.length - memberCount;
  const inviteTeams = isTeamAdminRestricted
    ? directory.teams.filter((team) => adminTeamIds.includes(team.id))
    : directory.teams;

  return (
    <ShellPage>
      <div className="overflow-x-auto">
        <OrganizationHeader organizationId={organizationId} activeId="members" isBilling={shell.isBilling} />
      </div>

      <SectionHeading
        title={t("common.members")}
        description={t("shell.organization.members.summary", { members: memberCount, invites: inviteCount })}
        cta={
          canInvite ? (
            <InviteMemberDialog
              organizationId={organizationId}
              inviteRoles={
                isTeamAdminRestricted
                  ? ["member"]
                  : getAssignableRoles({ currentRole, isFormbricksCloud: IS_FORMBRICKS_CLOUD })
              }
              isAccessControlAllowed={isAccessControlAllowed}
              teams={inviteTeams}
              isTeamAdminRestricted={isTeamAdminRestricted}
              upgradeHref={
                IS_FORMBRICKS_CLOUD
                  ? `/organizations/${organizationId}/billing`
                  : ENTERPRISE_LICENSE_REQUEST_FORM_URL
              }
              upgradeIsExternal={!IS_FORMBRICKS_CLOUD}
            />
          ) : undefined
        }
      />

      <MembersTable
        organizationId={organizationId}
        currentUserId={currentUserId}
        locale={locale}
        timeZone={getReportingTimeZone(shell.organization.displayTimeZone)}
        showTeams={isAccessControlAllowed && isOwnerOrManager}
        showTwoFactor={isOwnerOrManager}
        rows={rows}
      />

      {directory.isTruncated && (
        <p className="text-sm text-slate-500">{t("shell.organization.members.truncated")}</p>
      )}
    </ShellPage>
  );
};

export default MembersPage;
