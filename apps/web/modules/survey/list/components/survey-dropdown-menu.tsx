"use client";

import { MoreVertical, SquarePenIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { EditPublicSurveyAlertDialog } from "@/modules/survey/components/edit-public-survey-alert-dialog";
import { getV3ApiErrorMessage } from "@/modules/survey/list/lib/v3-surveys-client";
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
  disabled?: boolean;
  isSurveyCreationDeletionDisabled?: boolean;
  deleteSurvey: (surveyId: string) => Promise<void>;
}

export const SurveyDropDownMenu = ({
  environmentId,
  survey,
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

  const handleEditforActiveSurvey = (e: React.MouseEvent) => {
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
            {!isSurveyCreationDeletionDisabled && (
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
