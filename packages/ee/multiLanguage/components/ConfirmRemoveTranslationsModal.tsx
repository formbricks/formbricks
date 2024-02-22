import React from "react";

import { Button } from "@formbricks/ui/Button";
import { Modal } from "@formbricks/ui/Modal";

type ConfirmRemoveTranslationsModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onDelete: () => void;
};

const ConfirmRemoveTranslationsModal = ({ onDelete, open, setOpen }: ConfirmRemoveTranslationsModalProps) => {
  const handleDelete = async () => {
    await onDelete();
  };

  return (
    <Modal open={open} setOpen={setOpen} title="Delete Segment">
      <div className="text-slate-900">
        <p className="mt-2">This action will remove all the translations from this survey. Are you sure?</p>
      </div>

      <div className="mt-4 space-x-2 text-right">
        <Button variant="minimal" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="warn"
          onClick={() => {
            handleDelete();
          }}>
          Confirm
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmRemoveTranslationsModal;
