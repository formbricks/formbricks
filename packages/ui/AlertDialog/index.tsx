"use client";

import { Button } from "../Button";
import { Modal } from "../Modal";

interface AlertDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  headerText: string;
  mainText: string;
  confirmBtnLabel: string;
  declineBtnLabel?: string;
  declineBtnVariant?: "warn" | "minimal";
  onDecline: () => void;
  onConfirm?: () => void;
}

export default function AlertDialog({
  open,
  setOpen,
  headerText,
  mainText = "Are you sure? This action cannot be undone.",
  declineBtnLabel,
  onDecline,
  confirmBtnLabel,
  declineBtnVariant = "minimal",
  onConfirm,
}: AlertDialogProps) {
  return (
    <Modal open={open} setOpen={setOpen} title={headerText}>
      <p>{mainText}</p>
      <div className="space-x-2 text-right">
        <Button variant={declineBtnVariant} onClick={onDecline}>
          {declineBtnLabel || "Discard"}
        </Button>
        <Button
          variant="darkCTA"
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
}
