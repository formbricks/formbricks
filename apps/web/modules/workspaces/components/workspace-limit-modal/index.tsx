"use client";

import { useTranslation } from "react-i18next";
import { LiteLicenseTip } from "@/modules/ee/license-check/components/lite-license-tip";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface WorkspaceLimitModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  workspaceLimit: number;
  buttons: [ModalButton, ModalButton];
  // Self-hosted without an active license: the extra workspace comes with the free Lite license.
  showLiteLicenseTip: boolean;
}

export const WorkspaceLimitModal = ({
  open,
  setOpen,
  workspaceLimit,
  buttons,
  showLiteLicenseTip,
}: Readonly<WorkspaceLimitModalProps>) => {
  const { t } = useTranslation();
  const title = showLiteLicenseTip
    ? t("common.add_workspace_lite_license_title")
    : t("common.unlock_more_workspaces_with_a_higher_plan");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {showLiteLicenseTip ? (
          <LiteLicenseTip
            feature="workspaces"
            title={title}
            description={t("common.add_workspace_lite_license_description")}
          />
        ) : (
          <UpgradePrompt
            title={title}
            description={t("common.you_have_reached_your_limit_of_workspace_limit", { workspaceLimit })}
            buttons={buttons}
            feature="workspaces"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
