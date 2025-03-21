"use client";

import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { Modal } from "@/modules/ui/components/modal";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { H4, Muted } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
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
    <Modal
      open={open}
      setOpen={setOpen}
      noPadding
      closeOnOutsideClick={false}
      className="overflow-visible"
      size="md"
      hideCloseButton>
      <div className="sticky top-0 flex h-full flex-col rounded-lg">
        <button
          className={cn(
            "absolute right-0 top-0 hidden pr-4 pt-4 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-0 sm:block"
          )}
          onClick={() => {
            setOpen(false);
          }}>
          <XIcon className="h-6 w-6 rounded-md bg-white" />
          <span className="sr-only">Close</span>
        </button>
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div>
                <H4>{t("environments.settings.teams.invite_member")}</H4>
                <Muted className="text-slate-500">
                  {t("environments.settings.teams.invite_member_description")}
                </Muted>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6 p-6">
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
      </div>
    </Modal>
  );
};
