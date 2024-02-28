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
  buttonVariant?: "warn" | "darkCTA";
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
}: ConfirmationModalProps) => {
  const handleButtonAction = async () => {
    if (isButtonDisabled) return;
    await onConfirm();
  };

  return (
    <Modal open={open} setOpen={setOpen} title={title}>
      <div className="text-slate-900">
        <p className="mt-2 whitespace-pre-wrap">{text}</p>
      </div>

      <div className="mt-4 space-x-2 text-right">
        <Button variant="minimal" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button disabled={isButtonDisabled} variant={buttonVariant} onClick={handleButtonAction}>
          {buttonText}
        </Button>
      </div>
    </Modal>
  );
};
