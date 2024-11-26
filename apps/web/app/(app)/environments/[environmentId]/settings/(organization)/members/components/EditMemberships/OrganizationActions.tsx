"use client";

import {
  inviteUserAction,
  leaveOrganizationAction,
} from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/actions";
import { AddMemberModal } from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/components/AddMemberModal";
import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TInvitee } from "@formbricks/types/invites";
import { TOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/Button";
import { CreateOrganizationModal } from "@formbricks/ui/CreateOrganizationModal";
import { CustomDialog } from "@formbricks/ui/CustomDialog";

type OrganizationActionsProps = {
  role: string;
  isAdminOrOwner: boolean;
  isLeaveOrganizationDisabled: boolean;
  organization: TOrganization;
  isInviteDisabled: boolean;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
  isMultiOrgEnabled: boolean;
};

export const OrganizationActions = ({
  isAdminOrOwner,
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
  const [isLeaveOrganizationModalOpen, setLeaveOrganizationModalOpen] = useState(false);
  const [isCreateOrganizationModalOpen, setCreateOrganizationModalOpen] = useState(false);
  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLeaveOrganization = async () => {
    setLoading(true);
    try {
      await leaveOrganizationAction({ organizationId: organization.id });
      toast.success("You left the organization successfully");
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
        data.map(async ({ name, email, role }) => {
          await inviteUserAction({ organizationId: organization.id, email, name, role });
        })
      );
      toast.success("Member invited successfully");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
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
            Leave organization
          </Button>
        )}
        {isMultiOrgEnabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCreateOrganizationModalOpen(true);
            }}>
            Create new organization
          </Button>
        )}
        {!isInviteDisabled && isAdminOrOwner && (
          <Button
            size="sm"
            onClick={() => {
              setAddMemberModalOpen(true);
            }}>
            Add member
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
        title="Are you sure?"
        text="You wil leave this organization and loose access to all surveys and responses. You can only rejoin if you are invited again."
        onOk={handleLeaveOrganization}
        okBtnText="Yes, leave organization"
        disabled={isLeaveOrganizationDisabled}
        isLoading={loading}>
        {isLeaveOrganizationDisabled && (
          <p className="mt-2 text-sm text-red-700">
            You cannot leave this organization as it is your only organization. Create a new organization
            first.
          </p>
        )}
      </CustomDialog>
    </>
  );
};
