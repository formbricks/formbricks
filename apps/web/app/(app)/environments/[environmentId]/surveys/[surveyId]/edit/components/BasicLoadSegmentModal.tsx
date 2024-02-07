"use client";

import toast from "react-hot-toast";

import { TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { Button } from "@formbricks/ui/Button";
import { Modal } from "@formbricks/ui/Modal";

import { loadNewBasicSegmentAction } from "../actions";

type LoadSegmentModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyId: string;
  step: "initial" | "load";
  setStep: (step: "initial" | "load") => void;
  currentSegment: TSegment;
  segments: TSegment[];
  setSegment: (segment: TSegment) => void;
  setIsSegmentEditorOpen: (isOpen: boolean) => void;
};

const BasicSegmentDetails = ({
  surveyId,
  setOpen,
  setSegment,
  currentSegment,
  segments,
  setIsSegmentEditorOpen,
}: {
  surveyId: string;
  currentSegment: TSegment;
  segments: TSegment[];
  setSegment: (segment: TSegment) => void;
  setOpen: (open: boolean) => void;
  setIsSegmentEditorOpen: (isOpen: boolean) => void;
}) => {
  const handleLoadNewSegment = async (segmentId: string) => {
    try {
      const updatedSurvey = await loadNewBasicSegmentAction(surveyId, segmentId);

      if (!updatedSurvey?.id) {
        throw new Error("Error loading segment");
      }

      if (!updatedSurvey.segment) {
        throw new Error("Error loading segment");
      }

      const parsedFilters = ZSegmentFilters.safeParse(updatedSurvey?.segment?.filters);

      if (!parsedFilters.success) {
        throw new Error("Invalid segment filters");
      }

      setSegment({
        ...updatedSurvey.segment,
        description: updatedSurvey.segment.description || "",
        filters: parsedFilters.data,
        surveys: updatedSurvey.segment.surveys,
      });

      setIsSegmentEditorOpen(false);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
      setOpen(false);
    }
  };

  const segmentsArray = segments?.filter((segment) => segment.id !== currentSegment.id && !segment.isPrivate);

  return (
    <div className="flex flex-col">
      {!segmentsArray?.length && (
        <div className="my-12 text-center text-base text-slate-600">You have not created a segment yet</div>
      )}

      {segmentsArray?.map((segment) => (
        <div
          key={segment.id}
          className="flex cursor-pointer flex-col gap-1 rounded-lg px-4 py-3 hover:bg-slate-100"
          onClick={() => {
            handleLoadNewSegment(segment.id);
          }}>
          <div className="text-base font-medium text-slate-900">{segment.title}</div>
          <div className="text-sm text-slate-500">{segment.description}</div>
        </div>
      ))}
    </div>
  );
};

const BasicLoadSegmentModal = ({
  surveyId,
  open,
  setOpen,
  setStep,
  step,
  currentSegment,
  segments,
  setSegment,
  setIsSegmentEditorOpen,
}: LoadSegmentModalProps) => {
  const handleResetState = () => {
    setStep("initial");
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      setOpen={() => {
        handleResetState();
      }}
      title="Load Segment">
      {step === "initial" && (
        <div>
          <p className="text-slate-600">Loading a segment overwrites all current filters. Are you sure?</p>
          <div className="mt-3 space-x-2 text-right">
            <Button
              variant="minimal"
              onClick={() => {
                handleResetState();
              }}>
              Cancel
            </Button>
            <Button
              variant="darkCTA"
              onClick={() => {
                setStep("load");
              }}>
              Load Segment
            </Button>
          </div>
        </div>
      )}

      {step === "load" && (
        <BasicSegmentDetails
          surveyId={surveyId}
          setOpen={setOpen}
          setSegment={setSegment}
          currentSegment={currentSegment}
          segments={segments}
          setIsSegmentEditorOpen={setIsSegmentEditorOpen}
        />
      )}
    </Modal>
  );
};

export default BasicLoadSegmentModal;
