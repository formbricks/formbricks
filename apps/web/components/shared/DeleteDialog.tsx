import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/Button";

export default function DeleteDialog({ open, setOpen, deleteWhat, onDelete }) {
  return (
    <Modal open={open} setOpen={setOpen} title={`Delete ${deleteWhat}`}>
      <p>Are you sure? This action cannot be undone.</p>
      <div className="my-4 space-x-2 text-right">
        <Button variant="secondary" onClick={setOpen}>
          Cancel
        </Button>
        <Button variant="warn" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}
