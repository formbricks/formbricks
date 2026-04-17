"use client";

import { EyeIcon, LinkIcon, MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { copySurveyLink } from "@/modules/survey/lib/client-utils";
import { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface SurveyDropDownMenuProps {
  environmentId: string;
  survey: TSurveyListItem;
  publicDomain: string;
  disabled?: boolean;
  isSurveyCreationDeletionDisabled?: boolean;
  deleteSurvey: (surveyId: string) => Promise<void>;
}

export const SurveyDropDownMenu = ({
  environmentId,
  survey,
  publicDomain,
  disabled,
  isSurveyCreationDeletionDisabled,
  deleteSurvey,
}: SurveyDropDownMenuProps) => {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);
  const router = useRouter();

  const editHref = `/environments/${environmentId}/surveys/${survey.id}/edit`;
  const surveyLink = useMemo(() => `${publicDomain}/s/${survey.id}`, [publicDomain, survey.id]);
  const isSingleUseEnabled = survey.singleUse?.enabled ?? false;
  const canManageSurvey = !isSurveyCreationDeletionDisabled;
  const canPreviewOrCopyLink = survey.type === "link" && survey.status !== "draft";
  const hasVisibleActions = canManageSurvey || canPreviewOrCopyLink;

  const handleDeleteSurvey = async (surveyId: string) => {
    setLoading(true);

    try {
      await deleteSurvey(surveyId);
      toast.success(t("environments.surveys.survey_deleted_successfully"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("environments.surveys.error_deleting_survey")));
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
            aria-label={t("environments.surveys.open_options")}
            className={cn(
              "rounded-lg border bg-white p-2",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"
            )}>
            <span className="sr-only">{t("environments.surveys.open_options")}</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
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
                  <EyeIcon className="mr-2 h-4 w-4" />
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
                  <LinkIcon className="mr-2 h-4 w-4" />
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
                  <TrashIcon className="mr-2 h-4 w-4" />
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
          text={t("environments.surveys.delete_survey_and_responses_warning")}
          isDeleting={loading}
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
