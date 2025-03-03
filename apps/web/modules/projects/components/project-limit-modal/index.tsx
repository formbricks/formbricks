"use client";

import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { useTranslate } from "@tolgee/react";

interface ProjectLimitModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectLimit: number;
  buttons: [ModalButton, ModalButton];
}

export const ProjectLimitModal = ({ open, setOpen, projectLimit, buttons }: ProjectLimitModalProps) => {
  const { t } = useTranslate();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-[564px] bg-white">
        <DialogTitle>{t("common.projects_limit_reached")}</DialogTitle>
        <UpgradePrompt
          title={t("common.unlock_more_projects_with_a_higher_plan")}
          description={t("common.you_have_reached_your_limit_of_project_limit", { projectLimit })}
          buttons={buttons}
        />
      </DialogContent>
    </Dialog>
  );
};
