"use client";

import { loadNewUserSegmentAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { useUserSegments } from "@/lib/userSegments/userSegments";
import { Survey } from "@formbricks/types/surveys";
import { Dialog, DialogContent } from "@formbricks/ui";
import { produce } from "immer";
import React from "react";

type LoadSegmentModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  environmentId: string;
  step: "initial" | "load";
  setStep: (step: "initial" | "load") => void;
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
};

const SegmentDetails = ({
  environmentId,
  localSurvey,
  setLocalSurvey,
}: {
  environmentId: string;
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}) => {
  const { userSegments, isLoadingUserSegments } = useUserSegments(environmentId);

  const handleLoadNewSegment = async (segmentId: string) => {
    const updatedSurvey = await loadNewUserSegmentAction(localSurvey.id, segmentId);

    const survey = produce(localSurvey, (draft) => {
      // @ts-expect-error
      draft.userSegment = updatedSurvey.userSegment;
    });

    setLocalSurvey(survey);
  };

  if (isLoadingUserSegments) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col">
      {userSegments?.map((segment) => (
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
  open,
  setOpen,
  setStep,
  step,
  localSurvey,
  setLocalSurvey,
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
              environmentId={environmentId}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default LoadSegmentModal;
