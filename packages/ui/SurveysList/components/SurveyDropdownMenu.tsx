"use client";

import {
  ArrowUpFromLineIcon,
  CopyIcon,
  EyeIcon,
  LinkIcon,
  MousePointerClickIcon,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { TEnvironment } from "@formbricks/types/environment";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { DeleteDialog } from "../../DeleteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../DropdownMenu";
import { Modal } from "../../Modal";
import { copySurveyToOtherEnvironmentAction, deleteSurveyAction, getSurveyAction } from "../actions";
import SurveyCopyOptions from "./SurveyCopyOptions";

interface SurveyDropDownMenuProps {
  environmentId: string;
  productId: string;
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
  productId,
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
      const duplicatedSurvey = await copySurveyToOtherEnvironmentAction(
        environmentId,
        surveyId,
        environmentId,
        productId
      );
      router.refresh();
      const transformedDuplicatedSurvey = await getSurveyAction(duplicatedSurvey.id);
      if (transformedDuplicatedSurvey) duplicateSurvey(transformedDuplicatedSurvey);
      toast.success("Survey duplicated successfully.");
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
        <Modal open={isCopyFormOpen} setOpen={setIsCopyFormOpen} noPadding restrictOverflow>
          <div className="flex h-full flex-col rounded-lg">
            <div className="fixed left-0 right-0 z-10 h-24 rounded-t-lg bg-slate-100">
              <div className="flex w-full items-center justify-between p-6">
                <div className="flex items-center space-x-2">
                  <MousePointerClickIcon className="h-6 w-6 text-slate-500" />
                  <div>
                    <div className="text-xl font-medium text-slate-700">Copy Survey</div>
                    <div className="text-sm text-slate-500">Copy this survey to another environment</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-full max-h-[500px] overflow-auto pl-4 pt-24">
              <SurveyCopyOptions
                survey={survey}
                environmentId={environmentId}
                onCancel={() => setIsCopyFormOpen(false)}
                setOpen={(value) => {
                  setIsCopyFormOpen(value);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
