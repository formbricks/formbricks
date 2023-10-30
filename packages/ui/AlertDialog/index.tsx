"use client";

import { Modal } from "../Modal";
import { Button } from "../Button";

interface AlertDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  confirmWhat: string;
  onDiscard: () => void;
  text?: string;
  confirmButtonLabel: string;
  onSave?: () => void;
}

export default function AlertDialog({
  open,
  setOpen,
  confirmWhat,
  onDiscard,
  text,
  confirmButtonLabel,
  onSave,
}: AlertDialogProps) {
  return (
    <Modal open={open} setOpen={setOpen} title={`Confirm ${confirmWhat}`}>
      <p>{text || "Are you sure? This action cannot be undone."}</p>
      <div className="space-x-2 text-right">
        <Button variant="warn" onClick={onDiscard}>
          Discard
        </Button>
        <Button
          variant="darkCTA"
          onClick={() => {
            if (onSave) {
              onSave();
            }
            setOpen(false);
          }}>
          {confirmButtonLabel}
        </Button>
      </div>
    </Modal>
  );
}
