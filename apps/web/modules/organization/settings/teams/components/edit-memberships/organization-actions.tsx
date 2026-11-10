"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { getAccessFlags } from "@/lib/membership/utils";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { InviteMemberModal } from "@/modules/organization/settings/teams/components/invite-member/invite-member-modal";
import {
  inviteMember,
  inviteMembers,
  leaveOrganization,
} from "@/modules/organization/settings/teams/lib/api-client";
import {
  formatInviteFailureMessage,
  formatInviteFailureMessages,
  getInviteFailureReasonFromMessage,
} from "@/modules/organization/settings/teams/lib/invite-failure";
import { TInvitee } from "@/modules/organization/settings/teams/types/invites";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface OrganizationActionsProps {
  readonly role: TOrganizationRole;
  readonly membershipRole?: TOrganizationRole;
  readonly isLeaveOrganizationDisabled: boolean;
  readonly organization: TOrganization;
  readonly teams: TOrganizationTeam[];
  readonly isInviteDisabled: boolean;
  readonly isAccessControlAllowed: boolean;
  readonly isFormbricksCloud: boolean;
  readonly isDashboardViewerRoleEnabled: boolean;
  readonly isMultiOrgEnabled: boolean;
  readonly isUserManagementDisabledFromUi: boolean;
  /** `organization.manage_access`: owners and managers above the user-management floor (ENG-6812). */
  readonly canManageUsers: boolean;
  readonly isTeamAdmin: boolean;
  readonly userAdminTeamIds?: string[];
  readonly enterpriseLicenseRequestFormUrl: string;
  readonly isBulkInviteAllowed: boolean;
}

export const OrganizationActions = ({
  role,
  organization,
  membershipRole,
  teams,
  isLeaveOrganizationDisabled,
  isInviteDisabled,
  isAccessControlAllowed,
  isFormbricksCloud,
  isDashboardViewerRoleEnabled,
  isMultiOrgEnabled,
  isUserManagementDisabledFromUi,
  canManageUsers,
  isTeamAdmin,
  userAdminTeamIds,
  enterpriseLicenseRequestFormUrl,
  isBulkInviteAllowed,
}: OrganizationActionsProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isLeaveOrganizationModalOpen, setIsLeaveOrganizationModalOpen] = useState(false);
  const [isInviteMemberModalOpen, setIsInviteMemberModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;

  // Owners and managers invite as the organization, which the role floor decides; a team admin who is
  // neither invites into their own teams, which it doesn't (the server takes the same two paths).
  const canInvite = isOwnerOrManager ? canManageUsers : isAccessControlAllowed && isTeamAdmin;

  const handleLeaveOrganization = async () => {
    setLoading(true);
    try {
      await leaveOrganization(organization.id);
      toast.success(t("workspace.settings.general.member_deleted_successfully"));
      router.refresh();
      setLoading(false);
      localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
      router.push("/");
    } catch (err) {
      toast.error(getV3ApiErrorMessage(err, t("common.something_went_wrong_please_try_again")));
      setLoading(false);
    }
  };

  const handleAddMembers = async (data: TInvitee[]): Promise<boolean> => {
    const toastId = toast.loading(t("workspace.settings.general.inviting_member", { count: data.length }));

    try {
      if (data.length === 1) {
        try {
          await inviteMember({
            organizationId: organization.id,
            body: {
              email: data[0].email.toLowerCase(),
              name: data[0].name,
              role: data[0].role,
              teamIds: data[0].teamIds,
            },
          });
        } catch (error) {
          // A refusal the form knows ("Invite already exists") gets its own message; any other shows its reason.
          const errorMessage = getV3ApiErrorMessage(error, "");
          const failureReason = getInviteFailureReasonFromMessage(errorMessage);
          toast.error(
            failureReason === "unknown" && errorMessage
              ? errorMessage
              : formatInviteFailureMessage(t, { email: data[0].email, failureReason }),
            { id: toastId }
          );
          return false;
        }

        router.refresh();
        toast.success(t("workspace.settings.general.member_invited_successfully"), {
          id: toastId,
        });
        return true;
      }

      let inviteResults: Awaited<ReturnType<typeof inviteMembers>>;
      try {
        inviteResults = await inviteMembers({
          organizationId: organization.id,
          body: { invitees: data.map((invitee) => ({ ...invitee, email: invitee.email.toLowerCase() })) },
        });
      } catch (error) {
        toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")), {
          id: toastId,
        });
        return false;
      }

      router.refresh();

      const failedInvites = inviteResults
        .filter((invite) => !invite.success)
        .map((invite) => ({
          email: invite.email,
          failureReason: invite.failureReason ?? ("unknown" as const),
        }));
      const successInvites = inviteResults.filter((invite) => invite.success);

      if (successInvites.length > 0) {
        toast.success(
          t("workspace.settings.general.members_invited_successfully", { count: successInvites.length }),
          { id: toastId }
        );
        if (failedInvites.length > 0) {
          toast.error(formatInviteFailureMessages(t, failedInvites));
        }
        return true;
      }

      toast.error(formatInviteFailureMessages(t, failedInvites), { id: toastId });
      return false;
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`, { id: toastId });
      return false;
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end gap-x-2 text-right">
        {role !== "owner" && isMultiOrgEnabled && (
          <Button variant="destructive" size="sm" onClick={() => setIsLeaveOrganizationModalOpen(true)}>
            {t("workspace.settings.general.leave_organization")}
            <XIcon />
          </Button>
        )}

        {!isInviteDisabled && canInvite && !isUserManagementDisabledFromUi && (
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setIsInviteMemberModalOpen(true);
            }}>
            {t("workspace.settings.teams.invite_member")}
          </Button>
        )}
      </div>
      <InviteMemberModal
        open={isInviteMemberModalOpen}
        setOpen={setIsInviteMemberModalOpen}
        onSubmit={handleAddMembers}
        membershipRole={membershipRole}
        organizationId={organization.id}
        isAccessControlAllowed={isAccessControlAllowed}
        isFormbricksCloud={isFormbricksCloud}
        isDashboardViewerRoleEnabled={isDashboardViewerRoleEnabled}
        teams={teams}
        isOwnerOrManager={isOwnerOrManager}
        isTeamAdmin={isTeamAdmin}
        userAdminTeamIds={userAdminTeamIds}
        enterpriseLicenseRequestFormUrl={enterpriseLicenseRequestFormUrl}
        isBulkInviteAllowed={isBulkInviteAllowed}
      />

      <Dialog open={isLeaveOrganizationModalOpen} onOpenChange={setIsLeaveOrganizationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.settings.general.leave_organization_title")}</DialogTitle>
            <DialogDescription>
              {t("workspace.settings.general.leave_organization_description")}
            </DialogDescription>
          </DialogHeader>
          {isLeaveOrganizationDisabled && (
            <p className="mt-2 text-sm text-red-700">
              {t("workspace.settings.general.cannot_leave_only_organization")}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsLeaveOrganizationModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveOrganization}
              loading={loading}
              disabled={isLeaveOrganizationDisabled}>
              {t("workspace.settings.general.leave_organization_ok_btn_text")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
