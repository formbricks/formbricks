"use client";

import { useTranslations } from "next-intl";
import { Button } from "../Button";
import { Modal } from "../Modal";

interface DeleteDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  deleteWhat: string;
  onDelete: () => void;
  text?: string;
  isDeleting?: boolean;
  isSaving?: boolean;
  useSaveInsteadOfCancel?: boolean;
  onSave?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}

export const DeleteDialog = ({
  open,
  setOpen,
  deleteWhat,
  onDelete,
  text,
  isDeleting,
  isSaving,
  useSaveInsteadOfCancel = false,
  onSave,
  children,
  disabled,
}: DeleteDialogProps) => {
  const t = useTranslations();
  return (
    <Modal open={open} setOpen={setOpen} title={`${t("common.delete")} ${deleteWhat}`}>
      <p>{text || "Are you sure? This action cannot be undone."}</p>
      <div>{children}</div>
      <div className="mt-4 space-x-2 text-right">
        <Button
          loading={isSaving}
          variant="secondary"
          onClick={() => {
            if (useSaveInsteadOfCancel && onSave) {
              onSave();
            }
            setOpen(false);
          }}>
          {useSaveInsteadOfCancel ? t("common.save") : t("common.cancel")}
        </Button>
        <Button variant="warn" onClick={onDelete} loading={isDeleting} disabled={disabled}>
          {t("common.delete")}
        </Button>
      </div>
    </Modal>
  );
};
