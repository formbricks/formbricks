"use client";

import { CircleAlert, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
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

interface DeleteDialogProps {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly deleteWhat: string;
  readonly onDelete: () => void;
  readonly text?: string;
  readonly isDeleting?: boolean;
  readonly isSaving?: boolean;
  readonly useSaveInsteadOfCancel?: boolean;
  readonly onSave?: () => void;
  readonly children?: React.ReactNode;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly buttonLabel?: string;
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
  title,
  buttonLabel,
}: DeleteDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="narrow" hideCloseButton={true} disableCloseOnOutsideClick={true}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CircleAlert className="size-4" />
            <div>
              <DialogTitle>{title || t("common.delete_what", { deleteWhat })}</DialogTitle>
              <DialogDescription>{t("workspace.general.this_action_cannot_be_undone")}</DialogDescription>
            </div>
          </div>
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
            }}
            disabled={isDeleting || isSaving}>
            {useSaveInsteadOfCancel ? t("common.save") : t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            loading={isDeleting}
            disabled={disabled || isDeleting || isSaving}>
            <TrashIcon />
            {buttonLabel || t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
