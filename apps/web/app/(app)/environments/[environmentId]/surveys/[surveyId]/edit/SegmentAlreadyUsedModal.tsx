import { useRouter } from "next/navigation";
import React from "react";

import { Button } from "@formbricks/ui/Button";
import { Modal } from "@formbricks/ui/Modal";

type TSegmentAlreadyUsedModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  environmentId: string;
};

const SegmentAlreadyUsedModal = ({ open, setOpen, environmentId }: TSegmentAlreadyUsedModalProps) => {
  const router = useRouter();

  return (
    <Modal open={open} setOpen={setOpen} title="Forward to Segments View">
      <p>This segment is used in other surveys. To assure consistent data you cannot edit it here.</p>
      <div className="space-x-2 text-right">
        <Button
          variant="warn"
          onClick={() => {
            setOpen(false);
          }}>
          Discard
        </Button>
        <Button
          variant="darkCTA"
          onClick={() => {
            router.push(`/environments/${environmentId}/segments`);
          }}>
          Go to Segments
        </Button>
      </div>
    </Modal>
  );
};

export default SegmentAlreadyUsedModal;
