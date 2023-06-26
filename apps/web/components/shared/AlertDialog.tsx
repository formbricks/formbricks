"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@formbricks/ui";

interface AlertDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  confirmWhat: string;
  onDiscard: () => void;
  text?: string;
  useSaveInsteadOfCancel?: boolean;
  onSave?: () => void;
}

export default function AlertDialog({
  open,
  setOpen,
  confirmWhat,
  onDiscard,
  text,
  useSaveInsteadOfCancel = false,
  onSave,
}: AlertDialogProps) {
  return (
    <Modal open={open} setOpen={setOpen} title={`Confirm ${confirmWhat}`}>
      <p>{text || "Are you sure? This action cannot be undone."}</p>
      <div className="my-4 space-x-2 text-right">
        <Button variant="warn" onClick={onDiscard}>
          Discard
        </Button>
        <Button
          variant="darkCTA"
          onClick={() => {
            if (useSaveInsteadOfCancel && onSave) {
              onSave();
            }
            setOpen(false);
          }}>
          {useSaveInsteadOfCancel ? "Save" : "Cancel"}
        </Button>
      </div>
    </Modal>
  );
}
