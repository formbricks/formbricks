"use client";

import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { useTranslations } from "next-intl";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { BulkInviteTab } from "./BulkInviteTab";
import { IndividualInviteTab } from "./IndividualInviteTab";

interface AddMemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole }[]) => void;
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
  const t = useTranslations();
  const tabs = [
    {
      title: t("environments.settings.general.individual_invite"),
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
      title: t("environments.settings.general.bulk_invite"),
      children: (
        <BulkInviteTab
          setOpen={setOpen}
          onSubmit={onSubmit}
          canDoRoleManagement={canDoRoleManagement}
          isFormbricksCloud={isFormbricksCloud}
        />
      ),
    },
  ];

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        label={t("environments.settings.general.invite_organization_member")}
        closeOnOutsideClick={true}
      />
    </>
  );
};
