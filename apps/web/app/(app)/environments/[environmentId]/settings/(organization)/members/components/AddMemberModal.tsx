"use client";

import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";
import { BulkInviteTab } from "./BulkInviteTab";
import { IndividualInviteTab } from "./IndividualInviteTab";

export enum MembershipRole {
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}
interface AddMemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: MembershipRole }[]) => void;
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
