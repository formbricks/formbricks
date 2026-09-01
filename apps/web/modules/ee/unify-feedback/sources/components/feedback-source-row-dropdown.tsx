"use client";

import {
  EyeIcon,
  FileSpreadsheetIcon,
  MoreVertical,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { canReimportHistoricalData } from "../utils";

interface FeedbackSourceRowDropdownProps {
  feedbackSource: TFeedbackSourceWithMappings;
  onEdit: () => void;
  onCsvImport?: () => void;
  onReimport: () => Promise<void>;
  onToggleStatus: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function FeedbackSourceRowDropdown({
  feedbackSource,
  onEdit,
  onCsvImport,
  onReimport,
  onToggleStatus,
  onDelete,
}: Readonly<FeedbackSourceRowDropdownProps>) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReimportDialogOpen, setIsReimportDialogOpen] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReimporting, setIsReimporting] = useState(false);

  const isActive = feedbackSource.status === "active";
  const canReimport = canReimportHistoricalData(feedbackSource);
  const linkedSurveyId =
    feedbackSource.type === "formbricks_survey" ? feedbackSource.formbricksMappings[0]?.surveyId : undefined;

  const handleReimport = async () => {
    // The confirm button is already disabled while the import runs (Button applies
    // `disabled={loading || disabled}` to `buttonLoading`), so a second run cannot be started from
    // the dialog today. Guarding here as well keeps that invariant in this component instead of
    // resting on the shared Button's loading behaviour.
    if (isReimporting) return;

    setIsReimporting(true);
    try {
      await onReimport();
    } finally {
      setIsReimporting(false);
      setIsReimportDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div data-testid="feedbackSource-row-dropdown">
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger
          className="z-10 cursor-pointer rounded-lg border bg-white p-2 hover:bg-slate-50"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}>
          <span className="sr-only">{t("workspace.surveys.open_options")}</span>
          <MoreVertical className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            {feedbackSource.type === "csv" && onCsvImport && (
              <>
                <DropdownMenuItem>
                  <button
                    type="button"
                    className="flex w-full items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      onCsvImport();
                    }}>
                    <FileSpreadsheetIcon className="mr-2 size-4" />
                    {t("workspace.unify.import_csv_data")}
                  </button>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {canReimport && (
              <>
                {/* Disabled while a run is in flight: re-opening the dialog would show a spinning,
                    disabled Re-import button with nothing explaining why, and the in-flight run's
                    `finally` would then close the dialog the user had just re-opened. */}
                <DropdownMenuItem disabled={isReimporting}>
                  <button
                    type="button"
                    disabled={isReimporting}
                    className="flex w-full items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      setIsReimportDialogOpen(true);
                    }}>
                    <RefreshCwIcon className="mr-2 size-4" />
                    {t("workspace.unify.reimport_historic_data")}
                  </button>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {linkedSurveyId && (
              <>
                <DropdownMenuItem>
                  <button
                    type="button"
                    className="flex w-full items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      router.push(
                        `/workspaces/${feedbackSource.workspaceId}/surveys/${linkedSurveyId}/summary`
                      );
                    }}>
                    <EyeIcon className="mr-2 size-4" />
                    {`${t("common.view")} ${t("common.survey")}`}
                  </button>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  onEdit();
                }}>
                <SquarePenIcon className="mr-2 size-4" />
                {t("common.edit")}
              </button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={async (e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  await onToggleStatus();
                }}>
                {isActive ? <PauseIcon className="mr-2 size-4" /> : <PlayIcon className="mr-2 h-4 w-4" />}
                {isActive ? t("common.disable") : t("common.enable")}
              </button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <button
                type="button"
                className="flex w-full items-center"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  setIsDeleteDialogOpen(true);
                }}>
                <TrashIcon className="mr-2 size-4" />
                {t("common.delete")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        open={isReimportDialogOpen}
        setOpen={setIsReimportDialogOpen}
        title={t("workspace.unify.reimport_historic_data")}
        // ConfirmationModal falls back to "This action cannot be undone." when given no
        // description, which is the opposite of what a re-import does: it reconciles, so running
        // it again is the remedy rather than the risk.
        description={t("workspace.unify.reimport_historic_data_description")}
        body={t("workspace.unify.reimport_historic_data_confirmation")}
        buttonText={t("workspace.unify.reimport_historic_data_cta")}
        buttonVariant="default"
        buttonLoading={isReimporting}
        // A long import is exactly when a stray outside click is most costly: it would drop the
        // dialog while the request is in flight. Cancel and the X stay live — leaving on purpose is
        // fine, losing the dialog by accident is not.
        closeOnOutsideClick={!isReimporting}
        onConfirm={handleReimport}
        Icon={RefreshCwIcon}
      />

      <DeleteDialog
        deleteWhat={t("workspace.unify.source")}
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        text={t("workspace.unify.delete_source_confirmation")}
      />
    </div>
  );
}
