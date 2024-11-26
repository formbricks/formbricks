import React from "react";
import { Button } from "../Button";
import { Modal } from "../Modal";

type ConfirmationModalProps = {
  title: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  text: string;
  buttonText: string;
  isButtonDisabled?: boolean;
  buttonVariant?: "warn" | "primary";
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
  buttonVariant = "warn",
  buttonLoading = false,
  closeOnOutsideClick = true,
  hideCloseButton,
}: ConfirmationModalProps) => {
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
        <Button variant="minimal" onClick={() => setOpen(false)}>
          Cancel
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
