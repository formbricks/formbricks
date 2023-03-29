import Modal from "components/shared/Modal";

interface SurveyCreatedSuccessModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function SurveyCreatedSuccessModal({ open, setOpen }: SurveyCreatedSuccessModalProps) {
  return (
    <>
      <Modal open={open} setOpen={setOpen} title="Survey published 🎉">
        Your survey is live and collecting valuable insights!
      </Modal>
    </>
  );
}
