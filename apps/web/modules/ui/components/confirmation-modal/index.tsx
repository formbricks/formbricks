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

interface SecondaryButtonProps {
  text: string;
  onAction: () => void;
  variant?: "destructive" | "default" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}

interface ConfirmationModalProps {
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
  onCancel?: () => void;
  Icon?: React.ElementType;
  secondaryButton?: SecondaryButtonProps;
}

export const ConfirmationModal = ({
  title,
  open,
  setOpen,
  onConfirm,
  description,
  body,
  buttonText,
  isButtonDisabled = false,
  buttonVariant = "destructive",
  buttonLoading = false,
  closeOnOutsideClick = true,
  hideCloseButton,
  cancelButtonText,
  onCancel,
  Icon,
  secondaryButton,
}: ConfirmationModalProps) => {
  const { t } = useTranslate();

  const handleMainButtonAction = () => {
    if (isButtonDisabled) return;
    onConfirm();
  };

  const handleSecondaryButtonAction = () => {
    if (secondaryButton?.disabled || !secondaryButton?.onAction) return;
    secondaryButton.onAction();
  };

  const handleCancelAction = () => {
    if (onCancel) {
      onCancel();
    }
    setOpen(false);
  };

  const renderSecondaryButton = () => (
    <Button
      loading={secondaryButton?.loading}
      disabled={secondaryButton?.disabled}
      variant={secondaryButton?.variant}
      onClick={handleSecondaryButtonAction}>
      {secondaryButton?.text}
    </Button>
  );

  const renderMainButton = () => (
    <Button
      loading={buttonLoading}
      disabled={isButtonDisabled}
      variant={buttonVariant}
      onClick={handleMainButtonAction}>
      {buttonText}
    </Button>
  );

  const renderCancelButton = () => (
    <Button variant="ghost" onClick={handleCancelAction}>
      {cancelButtonText || t("common.cancel")}
    </Button>
  );

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
                {description ?? t("environments.project.general.this_action_cannot_be_undone")}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <p>{body}</p>
        </DialogBody>

        <DialogFooter>
          {secondaryButton ? (
            // Three-button layout when secondary action is present
            <div className="flex w-full justify-between">
              {renderCancelButton()}
              <div className="flex gap-2">
                {renderSecondaryButton()}
                {renderMainButton()}
              </div>
            </div>
          ) : (
            // Default two-button layout
            <>
              {renderCancelButton()}
              {renderMainButton()}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
