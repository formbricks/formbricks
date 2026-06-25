"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { TInvitee } from "@/modules/organization/settings/teams/types/invites";
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
  onSubmit: (data: TInvitee[]) => void;
  teams: TOrganizationTeam[];
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
  isStorageConfigured: boolean;
  isOwnerOrManager: boolean;
  isTeamAdmin: boolean;
  userAdminTeamIds?: string[];
  enterpriseLicenseRequestFormUrl: string;
  isBulkInviteAllowed: boolean;
}

export const InviteMemberModal = ({
  open,
  setOpen,
  onSubmit,
  teams,
  isAccessControlAllowed,
  isFormbricksCloud,
  membershipRole,
  isStorageConfigured,
  isOwnerOrManager,
  isTeamAdmin,
  userAdminTeamIds,
  enterpriseLicenseRequestFormUrl,
  isBulkInviteAllowed,
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
        onSubmit={onSubmit}
        isAccessControlAllowed={isAccessControlAllowed}
        isFormbricksCloud={isFormbricksCloud}
        teams={filteredTeams}
        membershipRole={membershipRole}
        showTeamAdminRestrictions={showTeamAdminRestrictions}
        enterpriseLicenseRequestFormUrl={enterpriseLicenseRequestFormUrl}
      />
    ),
    bulk: (
      <BulkInviteTab
        setOpen={setOpen}
        onSubmit={onSubmit}
        isAccessControlAllowed={isAccessControlAllowed}
        isFormbricksCloud={isFormbricksCloud}
        isStorageConfigured={isStorageConfigured}
        isBulkInviteAllowed={isBulkInviteAllowed}
        enterpriseLicenseRequestFormUrl={enterpriseLicenseRequestFormUrl}
      />
    ),
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick unconstrained>
        <DialogHeader>
          <DialogTitle>{t("workspace.settings.teams.invite_member")}</DialogTitle>
          <DialogDescription>{t("workspace.settings.teams.invite_member_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-col gap-6 overflow-y-auto">
          {!showTeamAdminRestrictions && (
            <TabToggle
              id="type"
              options={[
                { value: "individual", label: t("workspace.settings.teams.individual") },
                { value: "bulk", label: t("workspace.settings.teams.bulk_invite") },
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
