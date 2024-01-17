"use client";

import toast from "react-hot-toast";

import { TUserSegment, ZUserSegmentFilterGroup } from "@formbricks/types/userSegment";
import { Button } from "@formbricks/ui/Button";
import { Modal } from "@formbricks/ui/Modal";

import { loadNewUserSegmentAction } from "../lib/actions";

type LoadSegmentModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyId: string;
  step: "initial" | "load";
  setStep: (step: "initial" | "load") => void;
  userSegment: TUserSegment;
  userSegments: TUserSegment[];
  setUserSegment: (userSegment: TUserSegment) => void;
  setIsSegmentEditorOpen: (isOpen: boolean) => void;
};

const SegmentDetails = ({
  surveyId,
  setOpen,
  setUserSegment,
  userSegment,
  userSegments,
  setIsSegmentEditorOpen,
}: {
  surveyId: string;
  userSegment: TUserSegment;
  userSegments: TUserSegment[];
  setUserSegment: (userSegment: TUserSegment) => void;
  setOpen: (open: boolean) => void;
  setIsSegmentEditorOpen: (isOpen: boolean) => void;
}) => {
  const handleLoadNewSegment = async (segmentId: string) => {
    try {
      const updatedSurvey = await loadNewUserSegmentAction(surveyId, segmentId);

      if (!updatedSurvey?.id) {
        throw new Error("Error loading segment");
      }

      if (!updatedSurvey.userSegment) {
        throw new Error("Error loading segment");
      }

      const parsedFilters = ZUserSegmentFilterGroup.safeParse(updatedSurvey?.userSegment?.filters);

      if (!parsedFilters.success) {
        throw new Error("Invalid segment filters");
      }

      setUserSegment({
        ...updatedSurvey.userSegment,
        description: updatedSurvey.userSegment.description || "",
        filters: parsedFilters.data,
        surveys: updatedSurvey.userSegment.surveys.map((survey) => survey.id),
      });

      setIsSegmentEditorOpen(false);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
      setOpen(false);
    }
  };

  const userSegmentsArray = userSegments?.filter(
    (segment) => segment.id !== userSegment.id && !segment.isPrivate
  );

  return (
    <div className="flex flex-col">
      {!userSegmentsArray?.length && (
        <div className="my-12 text-center text-base text-slate-600">You have not created a segment yet</div>
      )}

      {userSegmentsArray?.map((segment) => (
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

const LoadSegmentModal = ({
  surveyId,
  open,
  setOpen,
  setStep,
  step,
  userSegment,
  userSegments,
  setUserSegment,
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
          <p className="text-slate-600">Loading a Segment overwrites all current filters.</p>
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
        <SegmentDetails
          surveyId={surveyId}
          setOpen={setOpen}
          setUserSegment={setUserSegment}
          userSegment={userSegment}
          userSegments={userSegments}
          setIsSegmentEditorOpen={setIsSegmentEditorOpen}
        />
      )}
    </Modal>
  );
};

export default LoadSegmentModal;
