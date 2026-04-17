"use client";

import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/modules/ui/components/dialog";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface WorkspaceLimitModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  workspaceLimit: number;
  buttons: [ModalButton, ModalButton];
}

export const WorkspaceLimitModal = ({ open, setOpen, workspaceLimit, buttons }: WorkspaceLimitModalProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <UpgradePrompt
          title={t("common.unlock_more_workspaces_with_a_higher_plan")}
          description={t("common.you_have_reached_your_limit_of_workspace_limit", { workspaceLimit })}
          buttons={buttons}
          feature="workspaces"
        />
      </DialogContent>
    </Dialog>
  );
};
