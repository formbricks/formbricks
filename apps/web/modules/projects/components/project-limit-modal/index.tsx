"use client";

import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";
import { EmptyContent, ModalButton } from "@/modules/ui/components/empty-content";
import { FolderIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface ProjectLimitModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectLimit: number;
  buttons: [ModalButton, ModalButton];
}

export const ProjectLimitModal = ({ open, setOpen, projectLimit, buttons }: ProjectLimitModalProps) => {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-[564px] bg-white">
        <DialogTitle>{t("common.projects_limit_reached")}</DialogTitle>
        <EmptyContent
          icon={<FolderIcon className="h-6 w-6 text-slate-900" />}
          title={t("common.unlock_more_projects_with_a_higher_plan")}
          description={t("common.you_have_reached_your_limit_of_project_limit", { projectLimit })}
          buttons={buttons}
        />
      </DialogContent>
    </Dialog>
  );
};
