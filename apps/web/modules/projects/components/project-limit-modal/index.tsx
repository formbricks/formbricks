"use client";

import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogContent } from "@/modules/ui/components/dialog";
import { FolderIcon } from "lucide-react";

export type ModalButton = {
  text: string;
  href?: string;
  onClick?: () => void;
};

interface ProjectLimitModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectLimit: number;
  buttons: [ModalButton, ModalButton];
}

export const ProjectLimitModal = ({ open, setOpen, projectLimit, buttons }: ProjectLimitModalProps) => {
  const [primaryButton, secondaryButton] = buttons;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-[564px] bg-white">
        <div className="flex flex-col items-center gap-6 p-6">
          <div className="rounded-md border border-slate-200 p-3">
            <FolderIcon className="h-6 w-6 text-slate-900" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xl font-semibold text-slate-900">Unlock more projects with a higher plan.</p>
            <p className="text-sm text-slate-500">You have reached your limit of {projectLimit} project.</p>
          </div>
          <div className="flex gap-3">
            <Button
              {...(primaryButton.href
                ? { href: primaryButton.href, target: "_blank" }
                : { onClick: primaryButton.onClick })}>
              {primaryButton.text}
            </Button>
            <Button
              variant="secondary"
              {...(primaryButton.href
                ? { href: primaryButton.href, target: "_blank" }
                : { onClick: primaryButton.onClick })}>
              {secondaryButton.text}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
