"use client";

import { cn } from "@/lib/cn";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { BulkInviteTab } from "./bulk-invite-tab";
import { IndividualInviteTab } from "./individual-invite-tab";

interface InviteMemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole }[]) => void;
  teams: TOrganizationTeam[];
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
  membershipRole?: TOrganizationRole;
}

export const InviteMemberModal = ({
  open,
  setOpen,
  onSubmit,
  teams,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
  membershipRole,
}: InviteMemberModalProps) => {
  const [type, setType] = useState<"individual" | "bulk">("individual");

  const { t } = useTranslate();

  const tabs = {
    individual: (
      <IndividualInviteTab
        setOpen={setOpen}
        environmentId={environmentId}
        onSubmit={onSubmit}
        canDoRoleManagement={canDoRoleManagement}
        isFormbricksCloud={isFormbricksCloud}
        teams={teams}
        membershipRole={membershipRole}
      />
    ),
    bulk: (
      <BulkInviteTab
        setOpen={setOpen}
        onSubmit={onSubmit}
        canDoRoleManagement={canDoRoleManagement}
        isFormbricksCloud={isFormbricksCloud}
      />
    ),
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick className="overflow-visible">
        <DialogHeader>
          <DialogTitle>{t("environments.settings.teams.invite_member")}</DialogTitle>
          <DialogDescription>{t("environments.settings.teams.invite_member_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <TabToggle
            id="type"
            options={[
              { value: "individual", label: t("environments.settings.teams.individual") },
              { value: "bulk", label: t("environments.settings.teams.bulk_invite") },
            ]}
            onChange={(inviteType) => setType(inviteType)}
            defaultSelected={type}
          />
          {tabs[type]}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
