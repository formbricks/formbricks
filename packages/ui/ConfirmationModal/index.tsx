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
};

const ConfirmationModal = ({
  title,
  onConfirm,
  open,
  setOpen,
  text,
  buttonText,
  isButtonDisabled = false,
}: ConfirmationModalProps) => {
  const handleButtonAction = async () => {
    if (isButtonDisabled) return;
    await onConfirm();
  };

  return (
    <Modal open={open} setOpen={setOpen} title={title}>
      <div className="text-slate-900">
        <p className="mt-2">{text}</p>
      </div>

      <div className="mt-4 space-x-2 text-right">
        <Button variant="minimal" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button disabled={isButtonDisabled} variant="warn" onClick={handleButtonAction}>
          {buttonText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
