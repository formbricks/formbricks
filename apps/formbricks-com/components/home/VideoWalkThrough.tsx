import { ResponsiveVideo } from "@formbricks/ui";
import Modal from "../shared/Modal";

interface VideoWalkThroughProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function VideoWalkThrough({ open, setOpen }: VideoWalkThroughProps) {
  return (
    <Modal open={open} setOpen={setOpen}>
      <div className="mt-5">
        <ResponsiveVideo src="/videos/walkthrough-v1.mp4" />
      </div>
    </Modal>
  );
}
