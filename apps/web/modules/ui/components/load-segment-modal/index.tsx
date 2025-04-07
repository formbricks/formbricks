"use client";

import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { Loader2, UsersIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { formatDate, timeSinceDate } from "@formbricks/lib/time";
import { TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SegmentDetailProps {
  segment: TSegment;
  setSegment: (segment: TSegment) => void;
  setOpen: (open: boolean) => void;
  setIsSegmentEditorOpen: (isOpen: boolean) => void;
  onSegmentLoad: (surveyId: string, segmentId: string) => Promise<TSurvey>;
  surveyId: string;
  currentSegment: TSegment;
}

const SegmentDetail = ({
  segment,
  setIsSegmentEditorOpen,
  setOpen,
  setSegment,
  onSegmentLoad,
  surveyId,
  currentSegment,
}: SegmentDetailProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const handleLoadNewSegment = async (segmentId: string) => {
    try {
      if (currentSegment.id === segmentId) {
        return;
      }

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

  return (
    <div
      key={segment.id}
      className={cn(
        "relative mt-1 grid h-16 cursor-pointer grid-cols-5 content-center rounded-lg hover:bg-slate-100",
        currentSegment.id === segment.id && "pointer-events-none bg-slate-100 opacity-60"
      )}
      onClick={async () => {
        setIsLoading(true);
        try {
          await handleLoadNewSegment(segment.id);
          setIsLoading(false);
        } catch (err) {
          setIsLoading(false);
        }
      }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 opacity-80">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      <div className="col-span-3 flex items-center pl-6 text-sm">
        <div className="flex items-center gap-4">
          <div className="ph-no-capture h-8 w-8 shrink-0 text-slate-700">
            <UsersIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <div className="ph-no-capture font-medium text-slate-900">{segment.title}</div>
            <div className="ph-no-capture text-xs font-medium text-slate-500">{segment.description}</div>
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
  );
};

type LoadSegmentModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyId: string;
  currentSegment: TSegment;
  segments: TSegment[];
  setSegment: (segment: TSegment) => void;
  setIsSegmentEditorOpen: (isOpen: boolean) => void;
  onSegmentLoad: (surveyId: string, segmentId: string) => Promise<TSurvey>;
};

export const LoadSegmentModal = ({
  open,
  surveyId,
  setOpen,
  currentSegment,
  segments,
  setSegment,
  setIsSegmentEditorOpen,
  onSegmentLoad,
}: LoadSegmentModalProps) => {
  const handleResetState = () => {
    setOpen(false);
  };
  const { t } = useTranslate();
  const segmentsArray = segments?.filter((segment) => !segment.isPrivate);

  return (
    <Modal
      open={open}
      setOpen={() => {
        handleResetState();
      }}
      title={t("environments.surveys.edit.load_segment")}
      size="lg">
      <>
        {!segmentsArray?.length ? (
          <div className="group">
            <div className="flex h-16 w-full flex-col items-center justify-center rounded-lg text-slate-700">
              {t("environments.surveys.edit.you_have_not_created_a_segment_yet")}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div>
              <div className="grid h-12 grid-cols-5 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                <div className="col-span-3 pl-6">{t("common.segment")}</div>
                <div className="col-span-1 hidden text-center sm:block">{t("common.updated_at")}</div>
                <div className="col-span-1 hidden text-center sm:block">{t("common.created_at")}</div>
              </div>

              {segmentsArray.map((segment) => (
                <SegmentDetail
                  segment={segment}
                  setIsSegmentEditorOpen={setIsSegmentEditorOpen}
                  setOpen={setOpen}
                  setSegment={setSegment}
                  onSegmentLoad={onSegmentLoad}
                  surveyId={surveyId}
                  currentSegment={currentSegment}
                />
              ))}
            </div>
          </div>
        )}
      </>
    </Modal>
  );
};
