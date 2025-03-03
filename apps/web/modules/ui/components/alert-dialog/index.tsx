"use client";

import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";

interface AlertDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  headerText: string;
  mainText: string;
  confirmBtnLabel: string;
  declineBtnLabel?: string;
  declineBtnVariant?: "destructive" | "ghost";
  onDecline: () => void;
  onConfirm?: () => void;
}

export const AlertDialog = ({
  open,
  setOpen,
  headerText,
  mainText,
  declineBtnLabel,
  onDecline,
  confirmBtnLabel,
  declineBtnVariant = "ghost",
  onConfirm,
}: AlertDialogProps) => {
  const { t } = useTranslate();
  return (
    <Modal open={open} setOpen={setOpen} title={headerText}>
      <p className="mb-6 text-slate-900">
        {mainText ?? t("common.are_you_sure_this_action_cannot_be_undone")}
      </p>
      <div className="space-x-2 text-right">
        <Button variant={declineBtnVariant} onClick={onDecline}>
          {declineBtnLabel || "Discard"}
        </Button>
        <Button
          onClick={() => {
            if (onConfirm) {
              onConfirm();
            } else {
              setOpen(false);
            }
          }}>
          {confirmBtnLabel}
        </Button>
      </div>
    </Modal>
  );
};
