"use client";

import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";
import { CircleAlert } from "lucide-react";

interface ChangeQuotaConfirmationModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  onDuplicate: () => void;
}

export const ChangeQuotaConfirmationModal = ({
  open,
  setOpen,
  onConfirm,
  onDuplicate,
}: ChangeQuotaConfirmationModalProps) => {
  const { t } = useTranslate();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[540px] space-y-4">
        <DialogHeader className="flex justify-center gap-2">
          <CircleAlert className="h-4 w-4 text-slate-500" />
          <div className="flex flex-col">
            <DialogTitle className="w-full text-left">
              {t("environments.surveys.edit.quotas.confirm_quota_changes")}
            </DialogTitle>
            <DialogDescription className="w-full text-left">
              <span className="mt-2 whitespace-pre-wrap">
                {t("environments.surveys.edit.quotas.save_changes_confirmation_text")}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <p>{t("environments.surveys.edit.quotas.save_changes_confirmation_body")}</p>
        </DialogBody>

        <DialogFooter>
          <div className="flex w-full justify-between">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  onDuplicate();
                }}>
                {t("environments.surveys.edit.quotas.duplicate_quota")}
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}>
                {t("common.continue")}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
