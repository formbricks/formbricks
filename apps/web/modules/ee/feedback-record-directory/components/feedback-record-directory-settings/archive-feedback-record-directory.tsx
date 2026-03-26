"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateFeedbackRecordDirectoryAction } from "@/modules/ee/feedback-record-directory/actions";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
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
      toast.error(getFormattedErrorMessage(response));
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
        <DeleteDialog
          open={isArchiveDialogOpen}
          setOpen={setIsArchiveDialogOpen}
          deleteWhat={t("environments.settings.feedback_record_directories.directory")}
          text={t("environments.settings.feedback_record_directories.are_you_sure_you_want_to_archive")}
          onDelete={handleArchive}
          isDeleting={isArchiving}
          title={t("environments.settings.feedback_record_directories.archive_directory")}
          buttonLabel={t("environments.settings.feedback_record_directories.archive")}
        />
      )}
    </>
  );
};
