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
import { TrashIcon } from "lucide-react";

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
      <DialogContent className="max-w-lg" hideCloseButton={true} disableCloseOnOutsideClick={true}>
        <DialogHeader>
          <DialogTitle>{`${t("common.delete")} ${deleteWhat}`}</DialogTitle>
          <DialogDescription>
            {t("environments.project.general.this_action_cannot_be_undone")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <p>{text}</p>
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
            <TrashIcon />
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
