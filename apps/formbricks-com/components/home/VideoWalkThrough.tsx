import { ResponsiveVideo } from "@formbricks/ui";
import Modal from "../shared/Modal";

interface VideoWalkThroughProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function VideoWalkThrough({ open, setOpen }: VideoWalkThroughProps) {
  return (
    <Modal open={open} setOpen={setOpen}>
      <ResponsiveVideo src="/videos/walkthrough-v1.mp4" />
    </Modal>
  );
}
