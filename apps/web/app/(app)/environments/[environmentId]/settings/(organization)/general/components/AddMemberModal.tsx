"use client";

import { TOrganizationRole } from "@formbricks/types/memberships";
import { ModalWithTabs } from "@formbricks/ui/components/ModalWithTabs";
import { BulkInviteTab } from "./BulkInviteTab";
import { IndividualInviteTab } from "./IndividualInviteTab";

interface AddMemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; organizationRole: TOrganizationRole }[]) => void;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
}

export const AddMemberModal = ({
  open,
  setOpen,
  onSubmit,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
}: AddMemberModalProps) => {
  const tabs = [
    {
      title: "Individual Invite",
      children: (
        <IndividualInviteTab
          setOpen={setOpen}
          environmentId={environmentId}
          onSubmit={onSubmit}
          canDoRoleManagement={canDoRoleManagement}
          isFormbricksCloud={isFormbricksCloud}
        />
      ),
    },
    {
      title: "Bulk Invite",
      children: (
        <BulkInviteTab setOpen={setOpen} onSubmit={onSubmit} canDoRoleManagement={canDoRoleManagement} />
      ),
    },
  ];

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        label={"Invite Organization Member"}
        closeOnOutsideClick={true}
      />
    </>
  );
};
