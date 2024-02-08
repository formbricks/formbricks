import React from "react";

import { TSegmentWithSurveyNames } from "@formbricks/types/segment";

import { Button } from "../Button";
import { Modal } from "../Modal";

type ConfirmDeleteSegmentModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  segment: TSegmentWithSurveyNames;
  onDelete: () => Promise<void>;
};

const ConfirmDeleteSegmentModal = ({ onDelete, open, segment, setOpen }: ConfirmDeleteSegmentModalProps) => {
  const handleDelete = async () => {
    await onDelete();
  };

  return (
    <Modal open={open} setOpen={setOpen} title="Delete Segment">
      <div className="flex flex-col gap-2">
        <p>
          Deleting a segment will remove it from all the surveys it is currently being used in. This action
          cannot be undone.
        </p>

        <div className="flex flex-col gap-2">
          <p>The following are the surveys this segment is used in:</p>
          <div className="flex flex-col gap-1">
            {segment.activeSurveys.map((survey) => (
              <p key={survey} className="text-sm font-semibold text-slate-800">
                {survey}
              </p>
            ))}
          </div>

          <div>
            <p>Note: All the running surveys this segment is used in will be paused!</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-x-2 text-right">
        <Button variant="darkCTA" onClick={() => setOpen(false)}>
          Decline
        </Button>
        <Button
          variant="warn"
          onClick={() => {
            handleDelete();
          }}>
          Delete
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteSegmentModal;
