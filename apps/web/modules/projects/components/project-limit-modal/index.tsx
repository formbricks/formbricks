"use client";

import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface ProjectLimitModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectLimit: number;
  buttons: [ModalButton, ModalButton];
}

export const ProjectLimitModal = ({ open, setOpen, projectLimit, buttons }: ProjectLimitModalProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle className="sr-only">
          {t("common.unlock_more_workspaces_with_a_higher_plan")}
        </DialogTitle>
        <UpgradePrompt
          title={t("common.unlock_more_workspaces_with_a_higher_plan")}
          description={t("common.you_have_reached_your_limit_of_workspace_limit", { projectLimit })}
          buttons={buttons}
          feature="workspaces"
        />
      </DialogContent>
    </Dialog>
  );
};
