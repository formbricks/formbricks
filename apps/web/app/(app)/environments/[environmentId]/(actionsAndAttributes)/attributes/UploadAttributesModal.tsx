import { Modal } from "@formbricks/ui";

interface UploadAttributesModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function UploadAttributesModal({ open, setOpen }: UploadAttributesModalProps) {
  return (
    <>
      <Modal open={open} setOpen={setOpen}>
        Upload CSV
      </Modal>
    </>
  );
}
