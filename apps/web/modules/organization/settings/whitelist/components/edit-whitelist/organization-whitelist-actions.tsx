"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { inviteUserAction, leaveOrganizationAction } from "@/modules/organization/settings/teams/actions";
import { TInvitee } from "@/modules/organization/settings/teams/types/invites";
import { addUserToWhitelistAction } from "@/modules/organization/settings/whitelist/actions";
import { AddWhitelistModal } from "@/modules/organization/settings/whitelist/components/add-whitelist/add-whitelist-modal";
import { Button } from "@/modules/ui/components/button";
import { CustomDialog } from "@/modules/ui/components/custom-dialog";
import { useTranslate } from "@tolgee/react";
import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@formbricks/lib/localStorage";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface OrganizationWhitelistActionsProps {
  role: TOrganizationRole;
  membershipRole?: TOrganizationRole;
  isLeaveOrganizationDisabled: boolean;
  organization: TOrganization;
  isInviteDisabled: boolean;
  environmentId: string;
  isMultiOrgEnabled: boolean;
}

export const OrganizationWhitelistActions = ({
  role,
  organization,
  membershipRole,
  isLeaveOrganizationDisabled,
  isInviteDisabled,
  environmentId,
  isMultiOrgEnabled,
}: OrganizationWhitelistActionsProps) => {
  const router = useRouter();
  const { t } = useTranslate();
  const [isLeaveOrganizationModalOpen, setLeaveOrganizationModalOpen] = useState(false);
  const [isAddWhitelistModalOpen, setAddWhitelistModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;

  const handleLeaveOrganization = async () => {
    setLoading(true);
    try {
      await leaveOrganizationAction({ organizationId: organization.id });
      toast.success(t("environments.settings.general.member_deleted_successfully"));
      router.refresh();
      setLoading(false);
      localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
      router.push("/");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  // TODO: Fix error and success messages for all whitelist components
  const handleAddUserToWhitelist = async (data: { email: string }[]) => {
    console.log("data", data);
    // Individual invite
    if (data.length === 1) {
      const addUserToWhitelistActionResult = await addUserToWhitelistAction({
        organizationId: organization.id,
        email: data[0].email.toLowerCase(),
        role: membershipRole ?? "member",
      });
      if (addUserToWhitelistActionResult?.data) {
        toast.success(t("environments.settings.general.member_invited_successfully"));
      } else {
        const errorMessage = getFormattedErrorMessage(addUserToWhitelistActionResult);
        toast.error(errorMessage);
      }
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
              setAddWhitelistModalOpen(true);
            }}>
            {t("environments.settings.whitelist.add_user")}
          </Button>
        )}
      </div>
      <AddWhitelistModal
        open={isAddWhitelistModalOpen}
        setOpen={setAddWhitelistModalOpen}
        onSubmit={handleAddUserToWhitelist}
        membershipRole={membershipRole}
        environmentId={environmentId}
        organizationId={organization.id}
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
