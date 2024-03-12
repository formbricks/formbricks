"use client";

import { ArrowUpFromLineIcon, CopyIcon, EyeIcon, LinkIcon, SquarePenIcon, TrashIcon } from "lucide-react";
import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import type { TEnvironment } from "@formbricks/types/environment";
import type { TSurvey } from "@formbricks/types/surveys";

import { DeleteDialog } from "../../DeleteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../DropdownMenu";
import LoadingSpinner from "../../LoadingSpinner";
import { copyToOtherEnvironmentAction, deleteSurveyAction, duplicateSurveyAction } from "../actions";

interface SurveyDropDownMenuProps {
  environmentId: string;
  survey: TSurvey;
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  webAppUrl: string;
  singleUseId?: string;
  isSurveyCreationDeletionDisabled?: boolean;
}

export default function SurveyDropDownMenu({
  environmentId,
  survey,
  environment,
  otherEnvironment,
  webAppUrl,
  singleUseId,
  isSurveyCreationDeletionDisabled,
}: SurveyDropDownMenuProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const router = useRouter();

  const surveyUrl = useMemo(() => webAppUrl + "/s/" + survey.id, [survey.id, webAppUrl]);

  const handleDeleteSurvey = async (survey: TSurvey) => {
    setLoading(true);
    try {
      await deleteSurveyAction(survey.id);
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
      await duplicateSurveyAction(environmentId, surveyId);
      router.refresh();
      toast.success("Survey duplicated successfully.");
    } catch (error) {
      toast.error("Failed to duplicate the survey.");
    }
    setLoading(false);
  };

  const copyToOtherEnvironment = async (surveyId: string) => {
    setLoading(true);
    try {
      await copyToOtherEnvironmentAction(environmentId, surveyId, otherEnvironment.id);
      if (otherEnvironment.type === "production") {
        toast.success("Survey copied to production env.");
      } else if (otherEnvironment.type === "development") {
        toast.success("Survey copied to development env.");
      }
      router.replace(`/environments/${otherEnvironment.id}`);
    } catch (error) {
      toast.error(`Failed to copy to ${otherEnvironment.type}`);
    }
    setLoading(false);
  };
  if (loading) {
    return (
      <div className="opacity-0.2 absolute left-0 top-0 h-full w-full bg-slate-100">
        <LoadingSpinner />
      </div>
    );
  }
  return (
    <>
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
                {environment.type === "development" ? (
                  <DropdownMenuItem>
                    <button
                      type="button"
                      className="flex w-full items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsDropDownOpen(false);
                        copyToOtherEnvironment(survey.id);
                      }}>
                      <ArrowUpFromLineIcon className="mr-2 h-4 w-4" />
                      Copy to Prod
                    </button>
                  </DropdownMenuItem>
                ) : environment.type === "production" ? (
                  <DropdownMenuItem>
                    <button
                      type="button"
                      className="flex w-full items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsDropDownOpen(false);
                        copyToOtherEnvironment(survey.id);
                      }}>
                      <ArrowUpFromLineIcon className="mr-2 h-4 w-4" />
                      Copy to Dev
                    </button>
                  </DropdownMenuItem>
                ) : null}
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
                  className="flex w-full  items-center"
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
    </>
  );
}
