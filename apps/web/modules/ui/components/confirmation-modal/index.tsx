"use client";

import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import React from "react";

type ConfirmationModalProps = {
  title: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  text: string;
  buttonText: string;
  isButtonDisabled?: boolean;
  buttonVariant?: "destructive" | "default";
  buttonLoading?: boolean;
  closeOnOutsideClick?: boolean;
  hideCloseButton?: boolean;
};

export const ConfirmationModal = ({
  title,
  onConfirm,
  open,
  setOpen,
  text,
  buttonText,
  isButtonDisabled = false,
  buttonVariant = "destructive",
  buttonLoading = false,
  closeOnOutsideClick = true,
  hideCloseButton,
}: ConfirmationModalProps) => {
  const { t } = useTranslate();
  const handleButtonAction = async () => {
    if (isButtonDisabled) return;
    await onConfirm();
  };

  return (
    <Modal
      open={open}
      setOpen={setOpen}
      title={title}
      hideCloseButton={hideCloseButton}
      closeOnOutsideClick={closeOnOutsideClick}>
      <div className="text-slate-900">
        <p className="mt-2 whitespace-pre-wrap">{text}</p>
      </div>

      <div className="mt-4 space-x-2 text-right">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          loading={buttonLoading}
          disabled={isButtonDisabled}
          variant={buttonVariant}
          onClick={handleButtonAction}>
          {buttonText}
        </Button>
      </div>
    </Modal>
  );
};
