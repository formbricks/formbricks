"use client";

import {
  copyToOtherEnvironmentAction,
  deleteSurveyAction,
  duplicateSurveyAction,
} from "@/app/(app)/environments/[environmentId]/actions";
import DeleteDialog from "@/components/shared/DeleteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/DropdownMenu";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { SURVEY_BASE_URL } from "@formbricks/lib/constants";
import type { TEnvironment } from "@formbricks/types/v1/environment";
import type { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import {
  ArrowUpOnSquareStackIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  LinkIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

interface SurveyDropDownMenuProps {
  environmentId: string;
  survey: TSurveyWithAnalytics;
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
}

export default function SurveyDropDownMenu({
  environmentId,
  survey,
  environment,
  otherEnvironment,
}: SurveyDropDownMenuProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const surveyUrl = useMemo(() => SURVEY_BASE_URL + survey.id, [survey]);

  const handleDeleteSurvey = async (survey) => {
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

  const duplicateSurveyAndRefresh = async (surveyId) => {
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

  const copyToOtherEnvironment = async (surveyId) => {
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
      <div className="opacity-0.2 absolute left-0 top-0 h-full w-full bg-gray-100">
        <LoadingSpinner />
      </div>
    );
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
          <div>
            <span className="sr-only">Open options</span>
            <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Link
                className="flex w-full items-center"
                href={`/environments/${environmentId}/surveys/${survey.id}/edit`}>
                <PencilSquareIcon className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <button
                className="flex w-full items-center"
                onClick={async () => {
                  duplicateSurveyAndRefresh(survey.id);
                }}>
                <DocumentDuplicateIcon className="mr-2 h-4 w-4" />
                Duplicate
              </button>
            </DropdownMenuItem>
            {environment.type === "development" ? (
              <DropdownMenuItem>
                <button
                  className="flex w-full items-center"
                  onClick={() => {
                    copyToOtherEnvironment(survey.id);
                  }}>
                  <ArrowUpOnSquareStackIcon className="mr-2 h-4 w-4" />
                  Copy to Prod
                </button>
              </DropdownMenuItem>
            ) : environment.type === "production" ? (
              <DropdownMenuItem>
                <button
                  className="flex w-full items-center"
                  onClick={() => {
                    copyToOtherEnvironment(survey.id);
                  }}>
                  <ArrowUpOnSquareStackIcon className="mr-2 h-4 w-4" />
                  Copy to Dev
                </button>
              </DropdownMenuItem>
            ) : null}
            {survey.type === "link" && survey.status !== "draft" && (
              <>
                <DropdownMenuItem>
                  <Link
                    className="flex w-full items-center"
                    href={`/s/${survey.id}?preview=true`}
                    target="_blank">
                    <EyeIcon className="mr-2 h-4 w-4" />
                    Preview Survey
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <button
                    className="flex w-full items-center"
                    onClick={() => {
                      navigator.clipboard.writeText(surveyUrl);
                      toast.success("Copied link to clipboard");
                    }}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Copy Link
                  </button>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem>
              <button
                className="flex w-full  items-center"
                onClick={() => {
                  setDeleteDialogOpen(true);
                }}>
                <TrashIcon className="mr-2 h-4 w-4" />
                Delete
              </button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDialog
        deleteWhat="Survey"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={() => handleDeleteSurvey(survey)}
        text="Are you sure you want to delete this survey and all of its responses? This action cannot be undone."
      />
    </>
  );
}
