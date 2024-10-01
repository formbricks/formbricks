import { Modal } from "@formbricks/ui/components/Modal";

interface UploadAttributesModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const UploadAttributesModal = ({ open, setOpen }: UploadAttributesModalProps) => {
  return (
    <>
      <Modal open={open} setOpen={setOpen}>
        Upload CSV
      </Modal>
    </>
  );
};
