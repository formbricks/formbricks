"use client";

import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface AlertDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  headerText: string;
  mainText: string;
  confirmBtnLabel: string;
  declineBtnLabel?: string;
  declineBtnVariant?: "destructive" | "ghost" | "outline";
  onDecline?: () => void;
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
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg" hideCloseButton={true}>
        <DialogHeader>
          <DialogTitle>{headerText}</DialogTitle>
        </DialogHeader>
        <DialogBody>{mainText}</DialogBody>
        <DialogFooter>
          {declineBtnLabel && onDecline && (
            <Button variant={declineBtnVariant} onClick={onDecline}>
              {declineBtnLabel}
            </Button>
          )}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
