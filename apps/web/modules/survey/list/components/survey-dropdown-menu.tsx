"use client";

import {
  ArrowUpFromLineIcon,
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
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { copySurveyLink } from "@/modules/survey/lib/client-utils";
import {
  copySurveyToOtherEnvironmentAction,
  deleteSurveyAction,
  getSurveyAction,
} from "@/modules/survey/list/actions";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { CopySurveyModal } from "./copy-survey-modal";

interface SurveyDropDownMenuProps {
  environmentId: string;
  survey: TSurvey;
  publicDomain: string;
  disabled?: boolean;
  isSurveyCreationDeletionDisabled?: boolean;
  deleteSurvey: (surveyId: string) => void;
  onSurveysCopied?: () => void;
}

export const SurveyDropDownMenu = ({
  environmentId,
  survey,
  publicDomain,
  disabled,
  isSurveyCreationDeletionDisabled,
  deleteSurvey,
  onSurveysCopied,
}: SurveyDropDownMenuProps) => {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isCopyFormOpen, setIsCopyFormOpen] = useState(false);
  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);

  const router = useRouter();

  const surveyLink = useMemo(() => publicDomain + "/s/" + survey.id, [survey.id, publicDomain]);
  const isSingleUseEnabled = survey.singleUse?.enabled ?? false;

  const handleDeleteSurvey = async (surveyId: string) => {
    setLoading(true);
    try {
      const result = await deleteSurveyAction({ surveyId });
      if (result?.serverError) {
        toast.error(getFormattedErrorMessage(result));
        return;
      }
      deleteSurvey(surveyId);
      toast.success(t("environments.surveys.survey_deleted_successfully"));
    } catch (error) {
      toast.error(t("environments.surveys.error_deleting_survey"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      e.preventDefault();
      setIsDropDownOpen(false);
      // For single-use surveys, this button is disabled, so we just copy the base link
      const copiedLink = copySurveyLink(surveyLink);
      navigator.clipboard.writeText(copiedLink);
      toast.success(t("common.copied_to_clipboard"));
    } catch (error) {
      logger.error(error);
      toast.error(t("environments.surveys.summary.failed_to_copy_link"));
    }
  };

  const duplicateSurveyAndRefresh = async (surveyId: string) => {
    setLoading(true);
    try {
      const duplicatedSurveyResponse = await copySurveyToOtherEnvironmentAction({
        surveyId,
        targetEnvironmentId: environmentId,
      });

      if (duplicatedSurveyResponse?.data) {
        const transformedDuplicatedSurvey = await getSurveyAction({
          surveyId: duplicatedSurveyResponse.data.id,
        });
        if (transformedDuplicatedSurvey?.data) {
          onSurveysCopied?.();
        }
        toast.success(t("environments.surveys.survey_duplicated_successfully"));
      } else {
        const errorMessage = getFormattedErrorMessage(duplicatedSurveyResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("environments.surveys.survey_duplication_error"));
    }
    setLoading(false);
  };

  const handleEditforActiveSurvey = (e) => {
    e.preventDefault();
    setIsDropDownOpen(false);
    setIsCautionDialogOpen(true);
  };

  return (
    <div
      id={`${survey.name.toLowerCase().split(" ").join("-")}-survey-actions`}
      data-testid="survey-dropdown-menu">
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild disabled={disabled}>
          <div
            className={cn(
              "rounded-lg border bg-white p-2",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"
            )}>
            <span className="sr-only">{t("environments.surveys.open_options")}</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            {!isSurveyCreationDeletionDisabled && (
              <>
                <DropdownMenuItem>
                  <Link
                    className="flex w-full items-center"
                    href={`/environments/${environmentId}/surveys/${survey.id}/edit`}
                    onClick={survey.responseCount > 0 ? handleEditforActiveSurvey : undefined}>
                    <SquarePenIcon className="mr-2 size-4" />
                    {t("common.edit")}
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem>
                  <button
                    type="button"
                    className="flex w-full items-center"
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      duplicateSurveyAndRefresh(survey.id);
                    }}>
                    <CopyIcon className="mr-2 h-4 w-4" />
                    {t("common.duplicate")}
                  </button>
                </DropdownMenuItem>
              </>
            )}
            {!isSurveyCreationDeletionDisabled && (
              <DropdownMenuItem>
                <button
                  type="button"
                  className="flex w-full items-center"
                  disabled={loading}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsDropDownOpen(false);
                    setIsCopyFormOpen(true);
                  }}>
                  <ArrowUpFromLineIcon className="mr-2 h-4 w-4" />
                  {t("common.copy")}...
                </button>
              </DropdownMenuItem>
            )}
            {survey.type === "link" && survey.status !== "draft" && (
              <>
                <DropdownMenuItem>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center",
                      isSingleUseEnabled && "cursor-not-allowed opacity-50"
                    )}
                    disabled={isSingleUseEnabled}
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      const previewUrl = surveyLink + "?preview=true";
                      window.open(previewUrl, "_blank");
                    }}>
                    <EyeIcon className="mr-2 h-4 w-4" />
                    {t("common.preview_survey")}
                  </button>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <button
                    type="button"
                    data-testid="copy-link"
                    className={cn(
                      "flex w-full items-center",
                      isSingleUseEnabled && "cursor-not-allowed opacity-50"
                    )}
                    disabled={isSingleUseEnabled}
                    onClick={async (e) => handleCopyLink(e)}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    {t("common.copy_link")}
                  </button>
                </DropdownMenuItem>
              </>
            )}
            {!isSurveyCreationDeletionDisabled && (
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

      {!isSurveyCreationDeletionDisabled && (
        <DeleteDialog
          deleteWhat={t("common.survey")}
          open={isDeleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          onDelete={() => handleDeleteSurvey(survey.id)}
          text={t("environments.surveys.delete_survey_and_responses_warning")}
          isDeleting={loading}
        />
      )}

      {survey.responseCount > 0 && (
        <EditPublicSurveyAlertDialog
          open={isCautionDialogOpen}
          setOpen={setIsCautionDialogOpen}
          isLoading={loading}
          primaryButtonAction={async () => {
            await duplicateSurveyAndRefresh(survey.id);
            setIsCautionDialogOpen(false);
          }}
          primaryButtonText={t("common.duplicate")}
          secondaryButtonAction={() =>
            router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`)
          }
          secondaryButtonText={t("common.edit")}
        />
      )}

      {isCopyFormOpen && (
        <CopySurveyModal open={isCopyFormOpen} setOpen={setIsCopyFormOpen} survey={survey} />
      )}
    </div>
  );
};
