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
import { useTranslate } from "@tolgee/react";

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
  const { t } = useTranslate();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`${t("common.delete")} ${deleteWhat}`}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <p>{text || t("common.are_you_sure_this_action_cannot_be_undone")}</p>
          {children && <div>{children}</div>}
        </DialogBody>

        <DialogFooter>
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
          <Button variant="destructive" onClick={onDelete} loading={isDeleting} disabled={disabled}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
