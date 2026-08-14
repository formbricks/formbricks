"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { TMember, TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { getAccessFlags } from "@/lib/membership/utils";
import { formatDateWithOrdinal } from "@/lib/utils/datetime";
import { EditMembershipRole } from "@/modules/ee/role-management/components/edit-membership-role";
import { MemberActions } from "@/modules/organization/settings/teams/components/edit-memberships/member-actions";
import { isInviteExpired } from "@/modules/organization/settings/teams/lib/utils";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { Badge } from "@/modules/ui/components/badge";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/** The two row shapes this table mixes: accepted memberships and pending invites. */
type TMemberRow = TMember | TInvite;

// Type guard to check if member is an invitee
const isInvitee = (member: TMemberRow): member is TInvite => {
  return (member as TInvite).expiresAt !== undefined;
};

/**
 * The four badge texts are English literals, as they were before this conversion. Fixing that needs new
 * i18n keys and is a behaviour change rather than a restyle, so it stays a follow-up.
 */
const getMembershipBadge = (member: TMemberRow, t: TFunction, locale: string) => {
  if (isInvitee(member)) {
    return isInviteExpired(member) ? (
      <Badge type="gray" text="Expired" size="tiny" data-testid="expired-badge" />
    ) : (
      <TooltipRenderer
        tooltipContent={`${t("workspace.settings.general.invite_expires_on", {
          date: formatDateWithOrdinal(member.expiresAt, locale),
        })}`}>
        <Badge type="warning" text="Pending" size="tiny" />
      </TooltipRenderer>
    );
  }

  if (!member.isActive) {
    return <Badge type="gray" text="Inactive" size="tiny" />;
  }

  return <Badge type="success" text="Active" size="tiny" />;
};

const showDeleteButton = (
  member: TMemberRow,
  {
    isOwnerOrManager,
    isManager,
    currentUserId,
    doesOrgHaveMoreThanOneOwner,
  }: Readonly<{
    isOwnerOrManager: boolean;
    isManager: boolean;
    currentUserId: string;
    doesOrgHaveMoreThanOneOwner: boolean;
  }>
): boolean => {
  if (isInvitee(member)) {
    return isOwnerOrManager;
  }

  if (!isOwnerOrManager) {
    return false;
  }

  if (member.userId === currentUserId) {
    return false;
  }

  if (isManager) {
    return member.role !== "owner";
  }

  if (member.role === "owner") {
    return doesOrgHaveMoreThanOneOwner;
  }

  return true;
};

/**
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478), and re-declaring the array per render buys
 * nothing.
 *
 * The two optional columns are pushed onto one array instead of being guarded in both a header file and a
 * row file. That duplication — the same two flags spelled out twice, in two components — is what let the
 * header and the rows drift apart in the first place.
 */
const getMemberColumns = ({
  t,
  locale,
  organization,
  currentUserRole,
  currentUserId,
  isAccessControlAllowed,
  isFormbricksCloud,
  isUserManagementDisabledFromUi,
  isOwnerOrManager,
  isManager,
  doesOrgHaveMoreThanOneOwner,
}: Readonly<{
  t: TFunction;
  locale: string;
  organization: TOrganization;
  currentUserRole: TOrganizationRole;
  currentUserId: string;
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  isUserManagementDisabledFromUi: boolean;
  isOwnerOrManager: boolean;
  isManager: boolean;
  doesOrgHaveMoreThanOneOwner: boolean;
}>): TSettingsTableColumn<TMemberRow>[] => {
  // `ph-no-capture` on the name, email and role cells is PostHog redaction, not styling.
  const columns: TSettingsTableColumn<TMemberRow>[] = [
    {
      id: "name",
      header: t("common.full_name"),
      headerClassName: "w-[17%]",
      cellClassName: "ph-no-capture",
      cell: (member) => member.name,
    },
    {
      id: "email",
      header: t("common.email"),
      headerClassName: "w-[25%]",
      cellClassName: "ph-no-capture",
      cell: (member) => member.email,
    },
  ];

  if (isAccessControlAllowed) {
    columns.push({
      id: "role",
      header: t("common.role"),
      headerClassName: "w-[17%]",
      cellClassName: "ph-no-capture",
      cell: (member) => (
        <EditMembershipRole
          currentUserRole={currentUserRole}
          memberRole={member.role}
          memberId={!isInvitee(member) ? member.userId : ""}
          organizationId={organization.id}
          userId={currentUserId}
          memberAccepted={!isInvitee(member) ? member.accepted : undefined}
          inviteId={isInvitee(member) ? member.id : ""}
          doesOrgHaveMoreThanOneOwner={doesOrgHaveMoreThanOneOwner}
          isFormbricksCloud={isFormbricksCloud}
          isUserManagementDisabledFromUi={isUserManagementDisabledFromUi}
        />
      ),
    });
  }

  columns.push({
    id: "status",
    header: t("common.status"),
    headerClassName: "w-[17%]",
    cell: (member) => getMembershipBadge(member, t, locale),
  });

  if (!isUserManagementDisabledFromUi) {
    columns.push({
      id: "actions",
      header: t("common.actions"),
      headerClassName: "w-[24%]",
      // `align` is doing real work here, unlike the other actions columns in this series: this header has
      // visible text, and `text-align` is the only thing that moves it. Right rather than the centre the
      // old header used, so the label sits over the controls it names.
      //
      // Nothing goes on `cellClassName`: `MemberActions` already renders its own `flex justify-end`
      // wrapper, and putting the flex on the `<td>` would stop it being a table-cell — killing the shared
      // `align-middle` and leaving the buttons baseline-aligned rather than centred.
      align: "right",
      cell: (member) => (
        <MemberActions
          organization={organization}
          member={isInvitee(member) ? undefined : member}
          invite={isInvitee(member) ? member : undefined}
          showDeleteButton={showDeleteButton(member, {
            isOwnerOrManager,
            isManager,
            currentUserId,
            doesOrgHaveMoreThanOneOwner,
          })}
        />
      ),
    });
  }

  return columns;
};

interface MembersInfoProps {
  organization: TOrganization;
  members: TMember[];
  invites: TInvite[];
  currentUserRole: TOrganizationRole;
  currentUserId: string;
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  isUserManagementDisabledFromUi: boolean;
}

export const MembersInfo = ({
  organization,
  invites,
  currentUserRole,
  members,
  currentUserId,
  isAccessControlAllowed,
  isFormbricksCloud,
  isUserManagementDisabledFromUi,
}: Readonly<MembersInfoProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const allMembers = [...members, ...invites];

  const { isOwner, isManager } = getAccessFlags(currentUserRole);
  const isOwnerOrManager = isOwner || isManager;

  const doesOrgHaveMoreThanOneOwner = allMembers.filter((member) => member.role === "owner").length > 1;

  return (
    <SettingsTable
      columns={getMemberColumns({
        t,
        locale,
        organization,
        currentUserRole,
        currentUserId,
        isAccessControlAllowed,
        isFormbricksCloud,
        isUserManagementDisabledFromUi,
        isOwnerOrManager,
        isManager,
        doesOrgHaveMoreThanOneOwner,
      })}
      rows={allMembers}
      getRowId={(member) => member.email}
      // Effectively unreachable: whoever is looking at this page is themselves a member.
      emptyMessage={t("common.no_results")}
      // These two ids are what `organization.spec.ts` and `invite-existing-account.spec.ts` locate. Kept
      // exactly where they were — on the row container and on each row — so this conversion needs no
      // spec changes. `#singleMemberInfo` repeating per row is invalid HTML and worth retiring, but that
      // is a spec change, so it stays a follow-up.
      bodyProps={{ id: "membersInfoWrapper" }}
      getRowProps={() => ({ id: "singleMemberInfo" })}
      aria-label={t("workspace.settings.general.manage_members")}
    />
  );
};
