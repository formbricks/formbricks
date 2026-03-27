"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateFeedbackRecordDirectoryAction } from "@/modules/ee/feedback-record-directory/actions";
import { getTranslatedFeedbackRecordDirectoryError } from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface ArchiveFeedbackRecordDirectoryProps {
  directoryId: string;
  onArchive: () => void;
  isOwnerOrManager: boolean;
}

export const ArchiveFeedbackRecordDirectory = ({
  directoryId,
  onArchive,
  isOwnerOrManager,
}: ArchiveFeedbackRecordDirectoryProps) => {
  const { t } = useTranslation();
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const router = useRouter();

  const handleArchive = async () => {
    setIsArchiving(true);

    const response = await updateFeedbackRecordDirectoryAction({ directoryId, data: { isArchived: true } });
    if (response?.serverError) {
      const errorCode = getFormattedErrorMessage(response);
      toast.error(getTranslatedFeedbackRecordDirectoryError(errorCode, t));
      setIsArchiveDialogOpen(false);
      setIsArchiving(false);
      return;
    }
    if (response?.data) {
      toast.success(t("environments.settings.feedback_record_directories.directory_archived_successfully"));
      onArchive?.();
      router.refresh();
    } else {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setIsArchiveDialogOpen(false);
    setIsArchiving(false);
  };

  return (
    <>
      <div className="flex flex-row items-baseline space-x-2">
        <TooltipRenderer
          shouldRender={!isOwnerOrManager}
          tooltipContent={t("environments.settings.feedback_record_directories.archive_not_allowed")}
          className="w-auto">
          <Button
            variant="destructive"
            type="button"
            className="w-auto"
            disabled={!isOwnerOrManager}
            onClick={() => setIsArchiveDialogOpen(true)}>
            {t("environments.settings.feedback_record_directories.archive_directory")}
          </Button>
        </TooltipRenderer>
      </div>

      {isArchiveDialogOpen && (
        <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
          <DialogContent width="narrow" hideCloseButton={true} disableCloseOnOutsideClick={true}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4" />
                <DialogTitle>
                  {t("environments.settings.feedback_record_directories.archive_directory")}
                </DialogTitle>
              </div>
            </DialogHeader>

            <DialogBody>
              <p>{t("environments.settings.feedback_record_directories.are_you_sure_you_want_to_archive")}</p>
            </DialogBody>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setIsArchiveDialogOpen(false)}
                disabled={isArchiving}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleArchive} loading={isArchiving}>
                {t("environments.settings.feedback_record_directories.archive")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
