import ResponsiveEmbed from "react-responsive-embed";
import Modal from "../shared/Modal";

interface EventDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function AddNoCodeEventModalDummy({ open, setOpen }: EventDetailModalProps) {
  return (
    <Modal open={open} setOpen={setOpen}>
      <ResponsiveEmbed
        src="https://www.tella.tv/video/clfrymq2f00sk0fjqd9r6btf1/embed?b=0&title=0&a=1&loop=0&t=0&muted=0"
        allowFullScreen
        className="rounded-lg"
      />
    </Modal>
  );
}
