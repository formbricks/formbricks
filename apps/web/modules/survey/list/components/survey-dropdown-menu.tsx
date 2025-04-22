"use client";

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
import { useTranslate } from "@tolgee/react";
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
import { cn } from "@formbricks/lib/cn";
import { CopySurveyModal } from "./copy-survey-modal";

interface SurveyDropDownMenuProps {
  environmentId: string;
  survey: TSurvey;
  surveyDomain: string;
  refreshSingleUseId: () => Promise<string | undefined>;
  disabled?: boolean;
  isSurveyCreationDeletionDisabled?: boolean;
  duplicateSurvey: (survey: TSurvey) => void;
  deleteSurvey: (surveyId: string) => void;
}

export const SurveyDropDownMenu = ({
  environmentId,
  survey,
  surveyDomain,
  refreshSingleUseId,
  disabled,
  isSurveyCreationDeletionDisabled,
  deleteSurvey,
  duplicateSurvey,
}: SurveyDropDownMenuProps) => {
  const { t } = useTranslate();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isCopyFormOpen, setIsCopyFormOpen] = useState(false);
  const [isCautionDialogOpen, setIsCautionDialogOpen] = useState(false);

  const router = useRouter();

  const surveyLink = useMemo(() => surveyDomain + "/s/" + survey.id, [survey.id, surveyDomain]);

  const handleDeleteSurvey = async (surveyId: string) => {
    setLoading(true);
    try {
      await deleteSurveyAction({ surveyId });
      deleteSurvey(surveyId);
      router.refresh();
      setDeleteDialogOpen(false);
      toast.success(t("environments.surveys.survey_deleted_successfully"));
    } catch (error) {
      toast.error(t("environments.surveys.error_deleting_survey"));
    }
    setLoading(false);
  };

  const handleCopyLink = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      e.preventDefault();
      setIsDropDownOpen(false);
      const newId = await refreshSingleUseId();
      const copiedLink = copySurveyLink(surveyLink, newId);
      navigator.clipboard.writeText(copiedLink);
      toast.success(t("common.copied_to_clipboard"));
      router.refresh();
    } catch (error) {
      toast.error(t("environments.surveys.summary.failed_to_copy_link"));
    }
  };

  const duplicateSurveyAndRefresh = async (surveyId: string) => {
    setLoading(true);
    try {
      const duplicatedSurveyResponse = await copySurveyToOtherEnvironmentAction({
        environmentId,
        surveyId,
        targetEnvironmentId: environmentId,
      });
      router.refresh();

      if (duplicatedSurveyResponse?.data) {
        const transformedDuplicatedSurvey = await getSurveyAction({
          surveyId: duplicatedSurveyResponse.data.id,
        });
        if (transformedDuplicatedSurvey?.data) duplicateSurvey(transformedDuplicatedSurvey.data);
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
      data-testid="survey-dropdown-menu"
      onClick={(e) => e.stopPropagation()}>
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
        <DropdownMenuContent className="w-40">
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
              <>
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
              </>
            )}
            {survey.type === "link" && survey.status !== "draft" && (
              <>
                <DropdownMenuItem>
                  <div
                    className="flex w-full cursor-pointer items-center"
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      const newId = await refreshSingleUseId();
                      const previewUrl = newId
                        ? `/s/${survey.id}?suId=${newId}&preview=true`
                        : `/s/${survey.id}?preview=true`;
                      window.open(previewUrl, "_blank");
                    }}>
                    <EyeIcon className="mr-2 h-4 w-4" />
                    {t("common.preview_survey")}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <button
                    type="button"
                    data-testid="copy-link"
                    className="flex w-full items-center"
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
          deleteWhat="Survey"
          open={isDeleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          onDelete={() => handleDeleteSurvey(survey.id)}
          text={t("environments.surveys.delete_survey_and_responses_warning")}
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
