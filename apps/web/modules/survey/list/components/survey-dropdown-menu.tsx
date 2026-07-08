"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import {
  ArrowRightLeftIcon,
  CopyIcon,
  EyeIcon,
  LinkIcon,
  MoreVertical,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { copySurveyLink } from "@/modules/survey/lib/client-utils";
import { copySurveyToOtherWorkspaceAction } from "@/modules/survey/list/actions";
import { CopySurveyModal } from "@/modules/survey/list/components/copy-survey-modal";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";

interface SurveyDropDownMenuProps {
  survey: TSurveyListItem;
  publicDomain: string;
  disabled?: boolean;
  isSurveyCreationDeletionDisabled?: boolean;
  isReadOnly: boolean;
  deleteSurvey: (surveyId: string) => Promise<void>;
  updateSurveyStatus: (surveyId: string, status: TSurveyStatus) => Promise<void>;
}

// Non-draft statuses that can be targeted by a status change from the list.
const CHANGEABLE_STATUSES: TSurveyStatus[] = ["inProgress", "paused", "completed"];

export const SurveyDropDownMenu = ({
  survey,
  publicDomain,
  disabled,
  isSurveyCreationDeletionDisabled,
  isReadOnly,
  deleteSurvey,
  updateSurveyStatus,
}: Readonly<SurveyDropDownMenuProps>) => {
  const { workspace } = useWorkspace();

  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const editHref = `/workspaces/${workspace?.id}/surveys/${survey.id}/edit`;

  const surveyLink = useMemo(() => `${publicDomain}/s/${survey.id}`, [publicDomain, survey.id]);
  const isSingleUseEnabled = survey.singleUse?.enabled ?? false;
  const canManageSurvey = !isSurveyCreationDeletionDisabled;
  const canPreviewOrCopyLink = survey.type === "link" && survey.status !== "draft";
  // Show the status submenu for non-draft surveys when the user has write access.
  const canChangeStatus = !isReadOnly && survey.status !== "draft";
  const hasVisibleActions = canManageSurvey || canPreviewOrCopyLink || canChangeStatus;

  const getStatusLabel = (t: TFunction, status: TSurveyStatus): string => {
    switch (status) {
      case "inProgress":
        return t("common.in_progress");
      case "paused":
        return t("common.paused");
      case "completed":
        return t("common.completed");
      case "draft":
        return t("common.draft");
      default:
        return "";
    }
  };

  const handleStatusChange = async (status: TSurveyStatus) => {
    setIsDropDownOpen(false);
    const toastId = toast.loading(t("workspace.surveys.status_updating"));
    try {
      await updateSurveyStatus(survey.id, status);
      toast.success(t("workspace.surveys.status_updated_successfully"), { id: toastId });
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.surveys.error_updating_status")), {
        id: toastId,
      });
    }
  };

  const handleDeleteSurvey = async (surveyId: string) => {
    setLoading(true);

    try {
      await deleteSurvey(surveyId);
      toast.success(t("workspace.surveys.survey_deleted_successfully"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.surveys.error_deleting_survey")));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      e.preventDefault();
      setIsDropDownOpen(false);
      await navigator.clipboard.writeText(copySurveyLink(surveyLink));
      toast.success(t("common.copied_to_clipboard"));
    } catch (error) {
      logger.error(error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  const handleEditforActiveSurvey = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDropDownOpen(false);
    setIsCautionDialogOpen(true);
  };

  const handleDuplicateSurvey = async () => {
    if (!workspace?.id) return;
    setIsDuplicating(true);
    setIsDropDownOpen(false);
    try {
      const response = await copySurveyToOtherWorkspaceAction({
        surveyId: survey.id,
        targetWorkspaceId: workspace.id,
      });
      if (response?.data) {
        toast.success(t("workspace.surveys.survey_duplicated_successfully"));
        await queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
        return;
      }
      toast.error(getFormattedErrorMessage(response));
    } catch (error) {
      logger.error(error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsDuplicating(false);
    }
  };

  if (!hasVisibleActions) {
    return null;
  }

  return (
    <div
      id={`${survey.name.toLowerCase().split(" ").join("-")}-survey-actions`}
      data-testid="survey-dropdown-menu">
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild disabled={disabled}>
          <button
            type="button"
            data-testid="survey-dropdown-trigger"
            aria-label={t("workspace.surveys.open_options")}
            className={cn(
              "rounded-lg border bg-white p-2",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"
            )}>
            <span className="sr-only">{t("workspace.surveys.open_options")}</span>
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            {canManageSurvey && (
              <DropdownMenuItem>
                <Link
                  className="flex w-full items-center"
                  href={editHref}
                  onClick={survey.responseCount > 0 ? handleEditforActiveSurvey : undefined}>
                  <SquarePenIcon className="mr-2 size-4" />
                  {t("common.edit")}
                </Link>
              </DropdownMenuItem>
            )}
            {canManageSurvey && (
              <DropdownMenuItem>
                <button
                  type="button"
                  data-testid="duplicate-survey"
                  className={cn("flex w-full items-center", isDuplicating && "cursor-not-allowed opacity-50")}
                  disabled={isDuplicating}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDuplicateSurvey();
                  }}>
                  <CopyIcon className="mr-2 size-4" />
                  {t("common.duplicate")}
                </button>
              </DropdownMenuItem>
            )}
            {canChangeStatus && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid="survey-status-submenu" chevronSide="left">
                  {t("workspace.surveys.change_status")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent sideOffset={8}>
                  <DropdownMenuRadioGroup
                    value={survey.status}
                    onValueChange={(value) => {
                      void handleStatusChange(value as TSurveyStatus);
                    }}>
                    {CHANGEABLE_STATUSES.map((status) => (
                      <DropdownMenuRadioItem
                        key={status}
                        value={status}
                        data-testid={`survey-status-option-${status}`}
                        onSelect={(e) => {
                          // Prevent Radix from closing the menu before we do — we close it manually
                          // in handleStatusChange so the loading toast plays in the page chrome.
                          e.preventDefault();
                        }}>
                        <span className="flex items-center gap-2">
                          <SurveyStatusIndicator status={status} />
                          {getStatusLabel(t, status)}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {canManageSurvey && workspace?.organizationId && (
              <DropdownMenuItem
                data-testid="copy-to-workspace"
                onSelect={(e) => {
                  e.preventDefault();
                  setIsDropDownOpen(false);
                  setIsCopyModalOpen(true);
                }}>
                <ArrowRightLeftIcon className="size-4" />
                {t("workspace.surveys.copy_to")}
              </DropdownMenuItem>
            )}
            {canPreviewOrCopyLink && (
              <DropdownMenuItem>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center",
                    isSingleUseEnabled && "cursor-not-allowed opacity-50"
                  )}
                  disabled={isSingleUseEnabled}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsDropDownOpen(false);
                    const previewUrl = new URL(surveyLink);
                    previewUrl.searchParams.set("preview", "true");
                    globalThis.window.open(previewUrl.toString(), "_blank");
                  }}>
                  <EyeIcon className="mr-2 size-4" />
                  {t("common.preview")}
                </button>
              </DropdownMenuItem>
            )}
            {canPreviewOrCopyLink && (
              <DropdownMenuItem>
                <button
                  type="button"
                  data-testid="copy-link"
                  className={cn(
                    "flex w-full items-center",
                    isSingleUseEnabled && "cursor-not-allowed opacity-50"
                  )}
                  disabled={isSingleUseEnabled}
                  onClick={handleCopyLink}>
                  <LinkIcon className="mr-2 size-4" />
                  {t("common.copy_link")}
                </button>
              </DropdownMenuItem>
            )}
            {canManageSurvey && (
              <DropdownMenuItem>
                <button
                  type="button"
                  className="flex w-full items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsDropDownOpen(false);
                    setDeleteDialogOpen(true);
                  }}>
                  <TrashIcon className="mr-2 size-4" />
                  {t("common.delete")}
                </button>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {canManageSurvey && (
        <DeleteDialog
          deleteWhat={t("common.survey")}
          open={isDeleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          onDelete={() => handleDeleteSurvey(survey.id)}
          text={t("workspace.surveys.delete_survey_and_responses_warning")}
          isDeleting={loading}
        />
      )}

      {canManageSurvey && workspace?.id && workspace.organizationId && (
        <CopySurveyModal
          open={isCopyModalOpen}
          setOpen={setIsCopyModalOpen}
          surveyId={survey.id}
          currentWorkspaceId={workspace.id}
          organizationId={workspace.organizationId}
        />
      )}

      {canManageSurvey && survey.responseCount > 0 && (
        <EditPublicSurveyAlertDialog
          open={isCautionDialogOpen}
          setOpen={setIsCautionDialogOpen}
          isLoading={loading}
          primaryButtonAction={async () => {
            setIsCautionDialogOpen(false);
            router.push(editHref);
          }}
          primaryButtonText={t("common.edit")}
          secondaryButtonAction={() => setIsCautionDialogOpen(false)}
          secondaryButtonText={t("common.cancel")}
        />
      )}
    </div>
  );
};
