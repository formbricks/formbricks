"use client";

import { CircleAlert } from "lucide-react";
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
  const { mutateAsync: purgeDataset, isPending } = usePurgeFeedbackDataset();

  const hasValidConfirmation = hasMatchingDatasetPurgeConfirmation(confirmationName, directoryName);
  // A dataset name has no length limit, so the *warning copy* shows a truncated one — the same
  // treatment the workspace-delete confirmation gives it. It is deliberately not used for the
  // confirmation label or placeholder: those tell the user what to type, and the typed value is
  // matched against the full name, so showing a truncated string there asks for something that can
  // never match (delete-workspace-render.tsx does the same: it truncates only the warning text, and
  // passes the untruncated name to both the confirmation label and the Input's placeholder).
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
      // No router.refresh(): nothing on this screen changes. The dataset table renders name,
      // workspaces and archived status — a purge touches none of them — and the purge is async, so
      // the records are still there when this resolves. Archiving does refresh, because it flips the
      // status column this one leaves alone.
      onPurge?.();
    } catch (error) {
      // A client-side abort is NOT a failure. AbortSignal.timeout only stops us waiting — the request
      // still reached the route, which may well have enqueued the purge. Reporting "something went
      // wrong" would tell someone their irreversible dataset-wide delete did not happen when it very
      // likely did, which is the worst direction to be wrong in here. Say the outcome is unknown
      // instead; re-running is safe either way, since the purge is idempotent and the Hub collapses a
      // repeat request into the one already in flight.
      // (It also arrives as a DOMException, which getV3ApiErrorMessage would surface verbatim as
      // "The operation was aborted due to timeout" — untranslated and meaningless to a user.)
      if (error instanceof DOMException) {
        // Neither success nor error, so neither styled variant fits. ToasterClient only styles
        // `success` and `error`, so a bare toast() would render icon-less and unlike every other
        // toast in the app — pass the same icon the confirmation dialog uses.
        toast(t("workspace.settings.feedback_directories.purge_outcome_unknown"), {
          icon: <CircleAlert className="size-4" />,
        });
        handleDialogOpenChange(false);

        return;
      }

      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
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
        // deleteWhat only feeds DeleteDialog's fallback title, which `title` below overrides, so it
        // never renders here. It is required by the prop type, hence the value.
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
              // This form is rendered (via DeleteDialog) inside the settings modal's own <form onSubmit=
              // {handleSubmit(handleSubmitForm)}>. Radix portals the dialog's DOM out to document.body,
              // but React's synthetic onSubmit still bubbles along the JSX tree, not the DOM tree — so
              // without stopPropagation, Enter here also reaches the outer form and saves the dataset
              // (toast "updated successfully", both dialogs close), regardless of what was typed.
              e.stopPropagation();
              // Enter bypasses the footer button, which is the only thing carrying `isDeleting`, so
              // without this a held Enter fires a second purge while the first is still in flight.
              if (isPending) return;
              await handlePurge();
            }}>
            <label htmlFor="purgeDatasetConfirmation">
              {t("workspace.settings.feedback_directories.purge_confirmation_name", {
                directoryName,
              })}
            </label>
            <Input
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder={directoryName}
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
