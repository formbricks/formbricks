"use client";

import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { inviteUserAction, leaveOrganizationAction } from "@/modules/organization/settings/teams/actions";
import { InviteMemberModal } from "@/modules/organization/settings/teams/components/invite-member/invite-member-modal";
import { Button } from "@/modules/ui/components/button";
import { CustomDialog } from "@/modules/ui/components/custom-dialog";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TInvitee } from "@formbricks/types/invites";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface OrganizationActionsProps {
  role: TOrganizationRole;
  isOwnerOrManager: boolean;
  isLeaveOrganizationDisabled: boolean;
  organization: TOrganization;
  teams: TOrganizationTeam[];
  isInviteDisabled: boolean;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
  isMultiOrgEnabled: boolean;
}

export const OrganizationActions = ({
  isOwnerOrManager,
  role,
  organization,
  teams,
  isLeaveOrganizationDisabled,
  isInviteDisabled,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
  isMultiOrgEnabled,
}: OrganizationActionsProps) => {
  const router = useRouter();
  const t = useTranslations();
  const [isLeaveOrganizationModalOpen, setLeaveOrganizationModalOpen] = useState(false);
  const [isInviteMemberModalOpen, setInviteMemberModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLeaveOrganization = async () => {
    setLoading(true);
    try {
      await leaveOrganizationAction({ organizationId: organization.id });
      toast.success(t("environments.settings.general.member_deleted_successfully"));
      router.refresh();
      setLoading(false);
      router.push("/");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const handleInviteMembers = async (data: TInvitee[]) => {
    try {
      await Promise.all(
        data.map(async ({ name, email, role, teamIds }) => {
          await inviteUserAction({ organizationId: organization.id, email, name, role, teamIds });
        })
      );
      toast.success(t("environments.settings.general.member_invited_successfully"));
    } catch (err) {
      toast.error(`${t("common.error")}: ${err.message}`);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end space-x-2 text-right">
        {role !== "owner" && isMultiOrgEnabled && (
          <Button variant="secondary" size="sm" onClick={() => setLeaveOrganizationModalOpen(true)}>
            {t("environments.settings.general.leave_organization")}
            <XIcon />
          </Button>
        )}

        {!isInviteDisabled && isOwnerOrManager && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setInviteMemberModalOpen(true);
            }}>
            {t("environments.settings.teams.invite_member")}
          </Button>
        )}
      </div>
      <InviteMemberModal
        open={isInviteMemberModalOpen}
        setOpen={setInviteMemberModalOpen}
        onSubmit={handleInviteMembers}
        canDoRoleManagement={canDoRoleManagement}
        isFormbricksCloud={isFormbricksCloud}
        environmentId={environmentId}
        teams={teams}
      />

      <CustomDialog
        open={isLeaveOrganizationModalOpen}
        setOpen={setLeaveOrganizationModalOpen}
        title={t("environments.settings.general.leave_organization_title")}
        text={t("environments.settings.general.leave_organization_description")}
        onOk={handleLeaveOrganization}
        okBtnText={t("environments.settings.general.leave_organization_ok_btn_text")}
        disabled={isLeaveOrganizationDisabled}
        isLoading={loading}>
        {isLeaveOrganizationDisabled && (
          <p className="mt-2 text-sm text-red-700">
            {t("environments.settings.general.cannot_leave_only_organization")}
          </p>
        )}
      </CustomDialog>
    </>
  );
};
