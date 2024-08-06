import React, { useMemo } from "react";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { Button } from "../Button";
import { Modal } from "../Modal";

interface ConfirmDeleteSegmentModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  segment: TSegmentWithSurveyNames;
  onDelete: () => Promise<void>;
}

export const ConfirmDeleteSegmentModal = ({
  onDelete,
  open,
  segment,
  setOpen,
}: ConfirmDeleteSegmentModalProps) => {
  const handleDelete = async () => {
    await onDelete();
  };

  const segmentHasSurveys = useMemo(() => {
    return segment.activeSurveys.length > 0 || segment.inactiveSurveys.length > 0;
  }, [segment.activeSurveys.length, segment.inactiveSurveys.length]);

  return (
    <Modal open={open} setOpen={setOpen} title="Delete Segment">
      <div className="text-slate-900">
        {segmentHasSurveys && (
          <div className="space-y-2">
            <p>You cannot delete this segment since it’s still used in these surveys:</p>
            <ol className="my-2 ml-4 list-decimal">
              {segment.activeSurveys.map((survey) => (
                <li key={survey}>{survey}</li>
              ))}
              {segment.inactiveSurveys.map((survey) => (
                <li key={survey}>{survey}</li>
              ))}
            </ol>
          </div>
        )}
        <p className="mt-2">
          {segmentHasSurveys
            ? "Please remove the segment from these surveys in order to delete it."
            : "Are you sure you want to delete this segment? This action cannot be undone."}
        </p>
      </div>

      <div className="mt-4 space-x-2 text-right">
        <Button variant="minimal" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button variant="warn" onClick={handleDelete} disabled={segmentHasSurveys}>
          Delete
        </Button>
      </div>
    </Modal>
  );
};
