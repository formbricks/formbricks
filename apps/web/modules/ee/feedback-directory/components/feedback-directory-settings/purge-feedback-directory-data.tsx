"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { truncate } from "@/lib/utils/strings";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { usePurgeFeedbackDataset } from "@/modules/ee/feedback-directory/hooks/use-purge-feedback-dataset";
import { hasMatchingDatasetPurgeConfirmation } from "@/modules/ee/feedback-directory/lib/purge-confirmation";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface PurgeFeedbackDirectoryDataProps {
  directoryId: string;
  directoryName: string;
  onPurge: () => void;
  isOwnerOrManager: boolean;
}

/**
 * Empties a feedback dataset: deletes every record it holds and the topics generated from them,
 * keeping the dataset and its sources.
 *
 * Confirmation requires typing the dataset's name. Unlike archiving, this is irreversible and
 * affects every workspace the dataset is shared with, so a single click is too cheap.
 */
export const PurgeFeedbackDirectoryData = ({
  directoryId,
  directoryName,
  onPurge,
  isOwnerOrManager,
}: Readonly<PurgeFeedbackDirectoryDataProps>) => {
  const { t } = useTranslation();
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const router = useRouter();
  const { mutateAsync: purgeDataset, isPending } = usePurgeFeedbackDataset();

  const hasValidConfirmation = hasMatchingDatasetPurgeConfirmation(confirmationName, directoryName);
  // A dataset name has no length limit, so the copy shows a truncated one — the same treatment the
  // workspace-delete confirmation gives it. The typed value is still matched against the full name.
  const displayName = truncate(directoryName, 30);

  const handleDialogOpenChange = (open: boolean) => {
    setIsPurgeDialogOpen(open);
    if (!open) {
      setConfirmationName("");
    }
  };

  const handlePurge = async () => {
    if (!hasValidConfirmation) return;

    try {
      await purgeDataset({ datasetId: directoryId });
      // "Started", not "done": the purge runs in the background, so the records are still there for
      // a moment after this resolves. Promising completion here would make the next screen look broken.
      toast.success(t("workspace.settings.feedback_directories.purge_started"));
      handleDialogOpenChange(false);
      onPurge?.();
      router.refresh();
    } catch (error) {
      // A timeout arrives as a DOMException, which getV3ApiErrorMessage would surface verbatim
      // ("The operation was aborted due to timeout") — untranslated and meaningless here.
      const message =
        error instanceof DOMException
          ? t("common.something_went_wrong_please_try_again")
          : getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"));
      toast.error(message);
    }
  };

  return (
    <>
      <div className="flex flex-row items-baseline gap-x-2">
        <TooltipRenderer
          shouldRender={!isOwnerOrManager}
          tooltipContent={t("workspace.settings.feedback_directories.purge_not_allowed")}
          className="w-auto">
          <Button
            variant="destructive"
            type="button"
            className="w-auto"
            disabled={!isOwnerOrManager}
            onClick={() => setIsPurgeDialogOpen(true)}>
            {t("workspace.settings.feedback_directories.purge_all_data")}
          </Button>
        </TooltipRenderer>
      </div>

      <DeleteDialog
        open={isPurgeDialogOpen}
        setOpen={handleDialogOpenChange}
        deleteWhat={displayName}
        title={t("workspace.settings.feedback_directories.purge_all_data")}
        buttonLabel={t("workspace.settings.feedback_directories.purge_all_data")}
        onDelete={handlePurge}
        isDeleting={isPending}
        disabled={!hasValidConfirmation}
        text={t("workspace.settings.feedback_directories.purge_all_data_warning", {
          directoryName: displayName,
        })}>
        <div className="py-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await handlePurge();
            }}>
            <label htmlFor="purgeDatasetConfirmation">
              {t("workspace.settings.feedback_directories.purge_confirmation_name", {
                directoryName: displayName,
              })}
            </label>
            <Input
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder={displayName}
              className="mt-2"
              type="text"
              id="purgeDatasetConfirmation"
              name="purgeDatasetConfirmation"
            />
          </form>
        </div>
      </DeleteDialog>
    </>
  );
};
