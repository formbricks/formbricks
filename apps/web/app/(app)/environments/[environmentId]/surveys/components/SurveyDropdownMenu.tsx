"use client";

import {
  copySurveyToOtherEnvironmentAction,
  deleteSurveyAction,
  getSurveyAction,
} from "@/app/(app)/environments/[environmentId]/surveys/actions";
import { TSurvey } from "@/app/(app)/environments/[environmentId]/surveys/types/surveys";
import {
  ArrowUpFromLineIcon,
  CopyIcon,
  EyeIcon,
  LinkIcon,
  MoreVertical,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import type { TEnvironment } from "@formbricks/types/environment";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";
import { CopySurveyModal } from "./CopySurveyModal";

interface SurveyDropDownMenuProps {
  environmentId: string;
  survey: TSurvey;
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  webAppUrl: string;
  singleUseId?: string;
  isSurveyCreationDeletionDisabled?: boolean;
  duplicateSurvey: (survey: TSurvey) => void;
  deleteSurvey: (surveyId: string) => void;
}

export const SurveyDropDownMenu = ({
  environmentId,
  survey,
  webAppUrl,
  singleUseId,
  isSurveyCreationDeletionDisabled,
  deleteSurvey,
  duplicateSurvey,
}: SurveyDropDownMenuProps) => {
  const t = useTranslations();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isCopyFormOpen, setIsCopyFormOpen] = useState(false);
  const router = useRouter();

  const surveyUrl = useMemo(() => webAppUrl + "/s/" + survey.id, [survey.id, webAppUrl]);

  const handleDeleteSurvey = async (surveyId: string) => {
    setLoading(true);
    try {
      await deleteSurveyAction({ surveyId });
      deleteSurvey(surveyId);
      router.refresh();
      setDeleteDialogOpen(false);
      toast.success("Survey deleted successfully.");
    } catch (error) {
      toast.error("An error occured while deleting survey");
    }
    setLoading(false);
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
        toast.success("Survey duplicated successfully.");
      } else {
        const errorMessage = getFormattedErrorMessage(duplicatedSurveyResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Failed to duplicate the survey.");
    }
    setLoading(false);
  };

  return (
    <div
      id={`${survey.name.toLowerCase().split(" ").join("-")}-survey-actions`}
      onClick={(e) => e.stopPropagation()}>
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
          <div className="rounded-lg border bg-white p-2 hover:bg-slate-50">
            <span className="sr-only">Open options</span>
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
                    href={`/environments/${environmentId}/surveys/${survey.id}/edit`}>
                    <SquarePenIcon className="mr-2 h-4 w-4" />
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
                    onClick={(e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      const previewUrl = singleUseId
                        ? `/s/${survey.id}?suId=${singleUseId}&preview=true`
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
                    className="flex w-full items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsDropDownOpen(false);
                      navigator.clipboard.writeText(
                        singleUseId ? `${surveyUrl}?suId=${singleUseId}` : surveyUrl
                      );
                      toast.success("Copied link to clipboard");
                      router.refresh();
                    }}>
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
          text={t("common.delete_survey_and_responses_warning")}
        />
      )}

      {isCopyFormOpen && (
        <CopySurveyModal open={isCopyFormOpen} setOpen={setIsCopyFormOpen} survey={survey} />
      )}
    </div>
  );
};
