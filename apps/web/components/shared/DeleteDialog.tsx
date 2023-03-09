import Modal from "@/components/shared/Modal";

export default function DeleteDialog({ open, setOpen, deleteWhat, onDelete }) {
  return (
    <Modal open={open} setOpen={setOpen} title="Delete Email Alert">
      <h3>Delete {deleteWhat} </h3>
      <p>This will permanently deactivate your account.</p>
      <p>Are you sure you want to delete {deleteWhat}? This action cannot be undone.</p>
      <button onClick={onDelete}>Delete</button>
      <button onClick={setOpen}>Cancel</button>
    </Modal>
  );
}
