"use client";

import { IndividualAddTab } from "@/modules/organization/settings/whitelist/components/add-whitelist/individual-add-tab";
import { Modal } from "@/modules/ui/components/modal";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { H4, Muted } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface AddWhitelistModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole }[]) => void;
  environmentId: string;
  membershipRole?: TOrganizationRole;
}

export const AddWhitelistModal = ({
  open,
  setOpen,
  onSubmit,
  environmentId,
  membershipRole,
}: AddWhitelistModalProps) => {
  const [type, setType] = useState<"individual">("individual");

  const { t } = useTranslate();

  const tabs = {
    individual: (
      <IndividualAddTab
        setOpen={setOpen}
        environmentId={environmentId}
        onSubmit={onSubmit}
        membershipRole={membershipRole}
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
          options={[{ value: "individual", label: t("environments.settings.teams.individual") }]}
          onChange={(inviteType) => setType(inviteType)}
          defaultSelected={type}
        />
        {tabs[type]}
      </div>
    </Modal>
  );
};
