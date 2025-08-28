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
import { CircleAlert } from "lucide-react";
import React from "react";

type ConfirmationModalProps = {
  title: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  description?: string;
  body: string;
  buttonText: string;
  isButtonDisabled?: boolean;
  buttonVariant?: "destructive" | "default";
  buttonLoading?: boolean;
  closeOnOutsideClick?: boolean;
  hideCloseButton?: boolean;
  cancelButtonText?: string;
  Icon?: React.ElementType;
};

export const ConfirmationModal = ({
  title,
  onConfirm,
  open,
  setOpen,
  description,
  body,
  buttonText,
  isButtonDisabled = false,
  buttonVariant = "destructive",
  buttonLoading = false,
  closeOnOutsideClick = true,
  hideCloseButton,
  cancelButtonText,
  Icon,
}: ConfirmationModalProps) => {
  const { t } = useTranslate();
  const handleButtonAction = async () => {
    if (isButtonDisabled) return;
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideCloseButton={hideCloseButton}
        disableCloseOnOutsideClick={!closeOnOutsideClick}
        className="max-w-[540px] space-y-4">
        <DialogHeader className="flex justify-center gap-2">
          {Icon ? (
            <Icon className="h-4 w-4 text-slate-500" />
          ) : (
            <CircleAlert className="h-4 w-4 text-slate-500" />
          )}
          <div className="flex flex-col">
            <DialogTitle className="w-full text-left">{title}</DialogTitle>
            <DialogDescription className="w-full text-left">
              <span className="mt-2 whitespace-pre-wrap">
                {description || t("environments.project.general.this_action_cannot_be_undone")}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <p>{body}</p>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {cancelButtonText || t("common.cancel")}
          </Button>
          <Button
            loading={buttonLoading}
            disabled={isButtonDisabled}
            variant={buttonVariant}
            onClick={handleButtonAction}>
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
