"use client";

import {
  inviteUserAction,
  leaveOrganizationAction,
} from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { AddMemberModal } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/components/AddMemberModal";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TInvitee } from "@formbricks/types/invites";
import { TOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/components/Button";
import { CreateOrganizationModal } from "@formbricks/ui/components/CreateOrganizationModal";
import { CustomDialog } from "@formbricks/ui/components/CustomDialog";

type OrganizationActionsProps = {
  role: string;
  isUserManagerOrOwner: boolean;
  isLeaveOrganizationDisabled: boolean;
  organization: TOrganization;
  isInviteDisabled: boolean;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
  isMultiOrgEnabled: boolean;
};

export const OrganizationActions = ({
  isUserManagerOrOwner,
  role,
  organization,
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
  const [isCreateOrganizationModalOpen, setCreateOrganizationModalOpen] = useState(false);
  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);
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

  const handleAddMembers = async (data: TInvitee[]) => {
    try {
      await Promise.all(
        data.map(async ({ name, email, organizationRole }) => {
          await inviteUserAction({ organizationId: organization.id, email, name, organizationRole });
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
          <Button
            EndIcon={XIcon}
            variant="secondary"
            size="sm"
            onClick={() => setLeaveOrganizationModalOpen(true)}>
            {t("environments.settings.general.leave_organization")}
          </Button>
        )}
        {isMultiOrgEnabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCreateOrganizationModalOpen(true);
            }}>
            {t("environments.settings.general.create_new_organization")}
          </Button>
        )}
        {!isInviteDisabled && isUserManagerOrOwner && (
          <Button
            size="sm"
            onClick={() => {
              setAddMemberModalOpen(true);
            }}>
            {t("environments.settings.general.add_member")}
          </Button>
        )}
      </div>
      <CreateOrganizationModal
        open={isCreateOrganizationModalOpen}
        setOpen={(val) => setCreateOrganizationModalOpen(val)}
      />
      <AddMemberModal
        open={isAddMemberModalOpen}
        setOpen={setAddMemberModalOpen}
        onSubmit={handleAddMembers}
        canDoRoleManagement={canDoRoleManagement}
        isFormbricksCloud={isFormbricksCloud}
        environmentId={environmentId}
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
