import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getMembershipsByUserId } from "@/modules/organization/settings/teams/lib/membership";
import { AskYourAgent } from "@/modules/shell/components/ask-your-agent";
import { OrganizationHeader } from "@/modules/shell/components/organization-header";
import { ShellPage } from "@/modules/shell/components/shell-page";
import { MembersTable } from "@/modules/shell/organization/components/members-table";
import { SectionHeading } from "@/modules/shell/organization/components/section-heading";
import { getMemberDirectory } from "@/modules/shell/organization/lib/member-directory";
import { getMemberRowActions } from "@/modules/shell/organization/lib/member-rows";
import { requireNonBillingRole } from "@/modules/shell/organization/lib/restricted-section";

const MembersPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await requireNonBillingRole(organizationId);
  const [t, locale] = await Promise.all([getTranslate(), getLocale()]);

  const currentUserId = shell.user.id;
  const currentRole = shell.membership.role;
  const isOwnerOrManager = shell.isOwner || shell.isManager;

  const [directory, isAccessControlAllowed, isMultiOrgEnabled, userMemberships] = await Promise.all([
    getMemberDirectory(organizationId, isOwnerOrManager),
    getAccessControlPermission(organizationId),
    getIsMultiOrgEnabled(),
    getMembershipsByUserId(currentUserId),
  ]);

  // Owner or manager, as far as USER_MANAGEMENT_MINIMUM_ROLE lets them manage people.
  const canManageUsers = getUserManagementAccess(currentRole, USER_MANAGEMENT_MINIMUM_ROLE);
  // Members are the agent's job now (list, invite, change roles, remove, resend and delete invites), and the
  // agent acts as owner or manager only. What stays here is copying an invite link and leaving.
  const canAskAgentToManage = canManageUsers && isOwnerOrManager;

  const rows = directory.rows.map((row) => ({
    row,
    actions: getMemberRowActions({
      row,
      currentUserId,
      currentRole,
      canManageUsers,
      isMultiOrgEnabled,
      hasOtherOrganizations: userMemberships.length > 1,
    }),
  }));

  const memberCount = directory.rows.filter((row) => row.kind === "member").length;
  const inviteCount = directory.rows.length - memberCount;

  return (
    <ShellPage>
      <div className="overflow-x-auto">
        <OrganizationHeader organizationId={organizationId} activeId="members" isBilling={shell.isBilling} />
      </div>

      <SectionHeading
        title={t("common.members")}
        description={t("shell.organization.members.summary", { members: memberCount, invites: inviteCount })}
      />

      {canAskAgentToManage && (
        <AskYourAgent
          description={t("shell.organization.members.ask_agent_manage")}
          prompt={t("shell.organization.members.ask_agent_manage_prompt")}
        />
      )}

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

      {isOwnerOrManager && (
        <AskYourAgent
          description={t("shell.organization.members.ask_agent_rename")}
          prompt={t("shell.organization.members.ask_agent_rename_prompt")}
        />
      )}
    </ShellPage>
  );
};

export default MembersPage;
