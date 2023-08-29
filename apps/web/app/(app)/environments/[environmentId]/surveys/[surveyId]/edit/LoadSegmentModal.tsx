"use client";

import { loadNewUserSegmentAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { useUserSegments } from "@/lib/userSegments/userSegments";
import { TUserSegment, ZUserSegmentFilterGroup } from "@formbricks/types/v1/userSegment";
import { Dialog, DialogContent } from "@formbricks/ui";
import React from "react";
import toast from "react-hot-toast";

type LoadSegmentModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyId: string;
  environmentId: string;
  step: "initial" | "load";
  setStep: (step: "initial" | "load") => void;
  userSegment: TUserSegment;
  setUserSegment: (userSegment: TUserSegment) => void;
};

const SegmentDetails = ({
  environmentId,
  surveyId,
  setOpen,
  setUserSegment,
  userSegment,
}: {
  environmentId: string;
  surveyId: string;
  userSegment: TUserSegment;
  setUserSegment: (userSegment: TUserSegment) => void;
  setOpen: (open: boolean) => void;
}) => {
  const { userSegments, isLoadingUserSegments } = useUserSegments(environmentId);

  const handleLoadNewSegment = async (segmentId: string) => {
    const updatedSurvey = await loadNewUserSegmentAction(surveyId, segmentId);

    if (!updatedSurvey.id) {
      toast.error("Error loading segment");
      return;
    }

    if (!updatedSurvey.userSegment) {
      toast.error("Error loading segment");
      return;
    }

    const parsedFilters = ZUserSegmentFilterGroup.safeParse(updatedSurvey.userSegment.filters);

    if (!parsedFilters.success) {
      console.log(parsedFilters.error);
      toast.error("Error loading segment");
      return;
    }

    setUserSegment({
      ...updatedSurvey.userSegment,
      description: updatedSurvey.userSegment.description || "",
      filters: parsedFilters.data,
      surveys: updatedSurvey.userSegment.surveys.map((survey) => survey.id),
    });

    setOpen(false);
  };

  if (isLoadingUserSegments) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col">
      {userSegments
        ?.filter((segment) => segment.id !== userSegment.id)
        ?.map((segment) => (
          <div
            key={segment.id}
            className="flex cursor-pointer flex-col gap-2 rounded-lg p-2 hover:bg-slate-100"
            onClick={() => {
              handleLoadNewSegment(segment.id);
            }}>
            <div className="text-base font-medium">{segment.title}</div>
            <div className="text-sm text-slate-500">{segment.description}</div>
          </div>
        ))}
    </div>
  );
};

const LoadSegmentModal = ({
  environmentId,
  surveyId,
  open,
  setOpen,
  setStep,
  step,
  userSegment,
  setUserSegment,
}: LoadSegmentModalProps) => {
  return (
    <div>
      {step === "initial" ? (
        <ConfirmDialog
          open={open}
          setOpen={setOpen}
          title="Overwrite current filters"
          description="Loading a Segment will overwrite all current filters. This can not be undone."
          primaryAction={() => {
            setStep("load");
          }}
          secondaryAction={() => setOpen(false)}
          primaryActionText="Load Segment anyways"
          secondaryActionText="Cancel"
        />
      ) : (
        <Dialog
          open={open}
          onOpenChange={(open) => {
            setOpen(open);
            setStep("initial");
          }}>
          <DialogContent hideCloseButton className="bg-slate-50">
            <SegmentDetails
              surveyId={surveyId}
              environmentId={environmentId}
              setOpen={setOpen}
              userSegment={userSegment}
              setUserSegment={setUserSegment}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default LoadSegmentModal;
