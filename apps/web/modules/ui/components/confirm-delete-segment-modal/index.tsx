"use client";

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSegmentActivitySummary } from "@/modules/ee/contacts/segments/components/segment-activity-utils";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface ConfirmDeleteSegmentModalProps {
  activitySummary: TSegmentActivitySummary;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onDelete: () => Promise<void>;
}

export const ConfirmDeleteSegmentModal = ({
  activitySummary,
  onDelete,
  open,
  setOpen,
}: ConfirmDeleteSegmentModalProps) => {
  const { t } = useTranslation();
  const handleDelete = async () => {
    await onDelete();
  };

  const allSurveys = useMemo(() => {
    return [...activitySummary.activeSurveys, ...activitySummary.inactiveSurveys];
  }, [activitySummary.activeSurveys, activitySummary.inactiveSurveys]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("environments.segments.delete_segment")}</DialogTitle>
          <DialogDescription>
            {t("environments.workspace.general.this_action_cannot_be_undone")}
          </DialogDescription>
        </DialogHeader>

        {allSurveys.length > 0 && (
          <DialogBody>
            <div className="space-y-2">
              <p>{t("environments.segments.cannot_delete_segment_used_in_surveys")}</p>
              <ol className="my-2 ml-4 list-decimal">
                {allSurveys.map((surveyName) => (
                  <li key={surveyName}>{surveyName}</li>
                ))}
              </ol>
            </div>
            <p className="mt-2">
              {t("environments.segments.please_remove_the_segment_from_these_surveys_in_order_to_delete_it")}
            </p>
          </DialogBody>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={allSurveys.length > 0}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
