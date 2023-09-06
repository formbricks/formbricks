"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@formbricks/ui";

interface AlertDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  headerText: string;
  mainText: string;
  confirmBtnLabel: string;
  declineBtnLabel: string;
  declineBtnVariant?: "warn" | "minimal";
  onFirstBtnClick: () => void;
  onSecondBtnClick?: () => void;
}

export default function AlertDialog({
  open,
  setOpen,
  headerText,
  mainText = "Are you sure? This action cannot be undone.",
  declineBtnLabel,
  onFirstBtnClick,
  confirmBtnLabel,
  declineBtnVariant = "minimal",
  onSecondBtnClick,
}: AlertDialogProps) {
  return (
    <Modal open={open} setOpen={setOpen} title={headerText}>
      <p>{mainText}</p>
      <div className="space-x-2 text-right">
        <Button variant={declineBtnVariant} onClick={onFirstBtnClick}>
          {declineBtnLabel}
        </Button>
        <Button
          variant="darkCTA"
          onClick={() => {
            if (onSecondBtnClick) {
              onSecondBtnClick();
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
