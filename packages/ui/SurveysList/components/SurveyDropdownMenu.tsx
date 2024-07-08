"use client";

import {
  ArrowUpFromLineIcon,
  CopyIcon,
  EyeIcon,
  LinkIcon,
  MousePointerClick,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { TEnvironment } from "@formbricks/types/environment";
import type { TSurvey } from "@formbricks/types/surveys";
import { DeleteDialog } from "../../DeleteDialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../DropdownMenu";
import {
  copyToOtherEnvironmentAction,
  deleteSurveyAction,
  duplicateSurveyAction,
  getSurveyAction,
} from "../actions";
import CopySurveyForm from "./SurveyCopyOptions";

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
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const [isCopyFormOpen, setIsCopyFormOpen] = useState(false);
  const router = useRouter();

  const surveyUrl = useMemo(() => webAppUrl + "/s/" + survey.id, [survey.id, webAppUrl]);

  const handleDeleteSurvey = async (survey: TSurvey) => {
    setLoading(true);
    try {
      await deleteSurveyAction(survey.id);
      deleteSurvey(survey.id);
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
      const duplicatedSurvey = await duplicateSurveyAction(environmentId, surveyId);
      router.refresh();
      const transformedDuplicatedSurvey = await getSurveyAction(duplicatedSurvey.id);
      if (transformedDuplicatedSurvey) duplicateSurvey(transformedDuplicatedSurvey);
      toast.success("Survey duplicated successfully.");
    } catch (error) {
      toast.error("Failed to duplicate the survey.");
    }
    setLoading(false);
  };

  const copyToOtherEnvironment = async (
    formData: {
      productId: string;
      targetenvironmentId: string;
      environmentType: string;
      productName: string;
    }[]
  ) => {
    setLoading(true);
    try {
      await Promise.all(
        formData.map(async (data) => {
          await copyToOtherEnvironmentAction(
            environmentId,
            survey.id,
            data.targetenvironmentId,
            data.productId
          );
        })
      );
      formData.forEach((data) => {
        setIsCopyFormOpen(false);
        toast.success(`Survey copied to ${data.environmentType} env of ${data.productName}`);
      });
    } catch (error) {
      toast.error(`Failed to copy to survey`);
    }

    setLoading(false);
  };

  return (
    <div
      id={`${survey.name.toLowerCase().split(" ").join("-")}-survey-actions`}
      onClick={(e) => e.stopPropagation()}>
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
          <div className="rounded-lg border p-2 hover:bg-slate-50">
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
                    Edit
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
                    Duplicate
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
                    Copy...
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
                    Preview Survey
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
                    Copy Link
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
                  Delete
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
          onDelete={() => handleDeleteSurvey(survey)}
          text="Are you sure you want to delete this survey and all of its responses? This action cannot be undone."
        />
      )}

      {isCopyFormOpen && (
        <div className="bg-red min-h-full min-w-full">
          <Dialog open={isCopyFormOpen} onOpenChange={setIsCopyFormOpen}>
            <DialogContent className="m-0 h-4/6 w-2/5 gap-0 overflow-hidden p-0 shadow-lg shadow-slate-500">
              <div className="m-0 flex max-h-28 min-h-28 items-center gap-0 bg-slate-100 p-0">
                <div>
                  <MousePointerClick className="ml-3 text-slate-500" />
                </div>
                <div>
                  <DialogTitle className="mb-0 pb-1 pl-6 text-xl text-slate-600"> Copy Survey</DialogTitle>
                  <DialogDescription className="mt-0 gap-0 pb-3 pl-6 text-slate-400">
                    Copy this survey to another environment or product.
                  </DialogDescription>
                </div>
              </div>

              <CopySurveyForm
                //username="smriti"
                environmentId={environmentId}
                surveyId={survey.id}
                onSubmit={copyToOtherEnvironment}
                onCancel={() => setIsCopyFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};
