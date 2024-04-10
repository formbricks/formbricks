"use client";

import ModalWithTabs from "@formbricks/ui/ModalWithTabs";

import BulkImportTab from "./BulkImportTab";
import IndividualInviteTab from "./IndividualInviteTab";

enum MembershipRole {
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}
interface MemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: MembershipRole }[]) => void;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
}

export default function AddMemberModal({
  open,
  setOpen,
  onSubmit,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
}: MemberModalProps) {
  const tabs = [
    {
      title: "Invite Individual",
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
      title: "Bulk Import",
      children: (
        <BulkImportTab setOpen={setOpen} onSubmit={onSubmit} canDoRoleManagement={canDoRoleManagement} />
      ),
    },
  ];

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        label={"Invite Team Member"}
        closeOnOutsideClick={false}
      />
    </>
  );
}
