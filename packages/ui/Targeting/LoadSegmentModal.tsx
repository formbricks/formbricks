"use client";

import { UserGroupIcon } from "@heroicons/react/24/solid";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { formatDate, timeSinceDate } from "@formbricks/lib/time";
import { TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys";

import { Button } from "../Button";
import { Modal } from "../Modal";

type SegmentDetailsProps = {
  surveyId: string;
  setOpen: (open: boolean) => void;
  setSegment: (segment: TSegment) => void;
  currentSegment: TSegment;
  segments: TSegment[];
  setIsSegmentEditorOpen: (isOpen: boolean) => void;
  onSegmentLoad: (surveyId: string, segmentId: string) => Promise<TSurvey>;
};

const SegmentDetails = ({
  surveyId,
  setOpen,
  setSegment,
  currentSegment,
  segments,
  setIsSegmentEditorOpen,
  onSegmentLoad,
}: SegmentDetailsProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadNewSegment = async (segmentId: string) => {
    try {
      setIsLoading(true);
      const updatedSurvey = await onSegmentLoad(surveyId, segmentId);

      if (!updatedSurvey?.id || !updatedSurvey?.segment) {
        toast.error("Error loading survey");
        setIsLoading(false);
        setIsSegmentEditorOpen(false);
        setOpen(false);
        return;
      }

      const parsedFilters = ZSegmentFilters.safeParse(updatedSurvey?.segment?.filters);

      if (!parsedFilters.success) {
        toast.error("Error loading survey");
        setIsLoading(false);
        setIsSegmentEditorOpen(false);
        setOpen(false);
        return;
      }

      setSegment({
        ...updatedSurvey.segment,
        description: updatedSurvey.segment.description || "",
        filters: parsedFilters.data,
        surveys: updatedSurvey.segment.surveys,
      });

      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err.message);
      setOpen(false);
    }
  };

  const segmentsArray = segments?.filter((segment) => segment.id !== currentSegment.id && !segment.isPrivate);

  if (!segmentsArray?.length) {
    return (
      <div className="group">
        <div className="flex h-16 w-full flex-col items-center justify-center rounded-lg text-slate-700">
          You have not created a segment yet
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div>
        <div className="grid h-12 grid-cols-5 content-center rounded-lg text-left text-sm font-semibold text-slate-900">
          <div className="col-span-3 pl-6">Title</div>
          <div className="col-span-1 hidden text-center sm:block">Updated</div>
          <div className="col-span-1 hidden text-center sm:block">Created</div>
        </div>

        {segmentsArray.map((segment) => (
          <div
            key={segment.id}
            className="relative grid h-16 cursor-pointer grid-cols-5 content-center rounded-lg hover:bg-slate-100"
            onClick={() => {
              if (isLoading) return;
              handleLoadNewSegment(segment.id);
            }}>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 opacity-80">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <div className="col-span-3 flex items-center pl-6 text-sm">
              <div className="flex items-center gap-4">
                <div className="ph-no-capture h-8 w-8 flex-shrink-0 text-slate-700">
                  <UserGroupIcon />
                </div>
                <div className="flex flex-col">
                  <div className="ph-no-capture font-medium text-slate-900">{segment.title}</div>
                  <div className="ph-no-capture text-xs font-medium text-slate-500">
                    {segment.description}
                  </div>
                </div>
              </div>
            </div>

            <div className="whitespace-wrap col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
              <div className="ph-no-capture text-slate-900">{timeSinceDate(segment.updatedAt)}</div>
            </div>

            <div className="whitespace-wrap col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
              <div className="ph-no-capture text-slate-900">{formatDate(segment.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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
  onSegmentLoad: (surveyId: string, segmentId: string) => Promise<TSurvey>;
};

const LoadSegmentModal = ({
  surveyId,
  open,
  setOpen,
  setStep,
  step,
  currentSegment,
  segments,
  setSegment,
  setIsSegmentEditorOpen,
  onSegmentLoad,
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
      title="Load Segment"
      size="lg">
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
        <SegmentDetails
          surveyId={surveyId}
          setOpen={setOpen}
          setSegment={setSegment}
          currentSegment={currentSegment}
          segments={segments}
          setIsSegmentEditorOpen={setIsSegmentEditorOpen}
          onSegmentLoad={onSegmentLoad}
        />
      )}
    </Modal>
  );
};

export default LoadSegmentModal;
