"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
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
import { BulkInviteTab } from "./bulk-invite-tab";
import { IndividualInviteTab } from "./individual-invite-tab";

interface InviteMemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole }[]) => void;
  teams: TOrganizationTeam[];
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
  membershipRole?: TOrganizationRole;
  isStorageConfigured: boolean;
  isOwnerOrManager: boolean;
  isTeamAdmin: boolean;
  userAdminTeamIds?: string[];
}

export const InviteMemberModal = ({
  open,
  setOpen,
  onSubmit,
  teams,
  isAccessControlAllowed,
  isFormbricksCloud,
  environmentId,
  membershipRole,
  isStorageConfigured,
  isOwnerOrManager,
  isTeamAdmin,
  userAdminTeamIds,
}: InviteMemberModalProps) => {
  const [type, setType] = useState<"individual" | "bulk">("individual");

  const { t } = useTranslation();

  const showTeamAdminRestrictions = !isOwnerOrManager && isTeamAdmin;

  const filteredTeams =
    showTeamAdminRestrictions && userAdminTeamIds
      ? teams.filter((t) => userAdminTeamIds.includes(t.id))
      : teams;

  const tabs = {
    individual: (
      <IndividualInviteTab
        setOpen={setOpen}
        environmentId={environmentId}
        onSubmit={onSubmit}
        isAccessControlAllowed={isAccessControlAllowed}
        isFormbricksCloud={isFormbricksCloud}
        teams={filteredTeams}
        membershipRole={membershipRole}
        showTeamAdminRestrictions={showTeamAdminRestrictions}
      />
    ),
    bulk: (
      <BulkInviteTab
        setOpen={setOpen}
        onSubmit={onSubmit}
        isAccessControlAllowed={isAccessControlAllowed}
        isFormbricksCloud={isFormbricksCloud}
        isStorageConfigured={isStorageConfigured}
      />
    ),
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick unconstrained>
        <DialogHeader>
          <DialogTitle>{t("environments.settings.teams.invite_member")}</DialogTitle>
          <DialogDescription>{t("environments.settings.teams.invite_member_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6" unconstrained>
          {!showTeamAdminRestrictions && (
            <TabToggle
              id="type"
              options={[
                { value: "individual", label: t("environments.settings.teams.individual") },
                { value: "bulk", label: t("environments.settings.teams.bulk_invite") },
              ]}
              onChange={(inviteType) => setType(inviteType)}
              defaultSelected={type}
            />
          )}
          {showTeamAdminRestrictions ? tabs.individual : tabs[type]}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
