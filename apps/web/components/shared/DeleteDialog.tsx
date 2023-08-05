"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@formbricks/ui";

interface DeleteDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  customTitle?: string;
  deleteWhat?: string;
  onDelete: () => void;
  text?: string;
  isDeleting?: boolean;
  useSaveInsteadOfCancel?: boolean;
  onSave?: () => void;
  children?: React.ReactNode;
  deleteBtnText?: string;
  disabled?: boolean;
}

export default function DeleteDialog({
  open,
  setOpen,
  customTitle,
  deleteWhat,
  onDelete,
  text,
  isDeleting,
  useSaveInsteadOfCancel = false,
  onSave,
  children,
  deleteBtnText,
  disabled,
}: DeleteDialogProps) {
  return (
    <Modal open={open} setOpen={setOpen} title={customTitle ? customTitle : `Delete ${deleteWhat}`}>
      <p>{text || "Are you sure? This action cannot be undone."}</p>
      <div>{children}</div>
      <div className="space-x-2 text-right">
        <Button
          variant="secondary"
          onClick={() => {
            if (useSaveInsteadOfCancel && onSave) {
              onSave();
            }
            setOpen(false);
          }}>
          {useSaveInsteadOfCancel ? "Save" : "Cancel"}
        </Button>
        <Button variant="warn" onClick={onDelete} loading={isDeleting} disabled={disabled}>
          {deleteBtnText || "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
