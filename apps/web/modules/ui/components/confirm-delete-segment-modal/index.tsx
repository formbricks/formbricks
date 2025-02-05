"use client";

import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import React, { useMemo } from "react";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";

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
  const { t } = useTranslate();
  const handleDelete = async () => {
    await onDelete();
  };

  const segmentHasSurveys = useMemo(() => {
    return segment.activeSurveys.length > 0 || segment.inactiveSurveys.length > 0;
  }, [segment.activeSurveys.length, segment.inactiveSurveys.length]);

  return (
    <Modal open={open} setOpen={setOpen} title={t("environments.segments.delete_segment")}>
      <div className="text-slate-900">
        {segmentHasSurveys && (
          <div className="space-y-2">
            <p>{t("environments.segments.cannot_delete_segment_used_in_surveys")}</p>
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
            ? t("environments.segments.please_remove_the_segment_from_these_surveys_in_order_to_delete_it")
            : t("common.are_you_sure_this_action_cannot_be_undone")}
        </p>
      </div>

      <div className="mt-4 space-x-2 text-right">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={segmentHasSurveys}>
          {t("common.delete")}
        </Button>
      </div>
    </Modal>
  );
};
