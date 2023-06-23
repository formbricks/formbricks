"use client";

import { Template } from "@/../../packages/types/templates";
import DeleteDialog from "@/components/shared/DeleteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/DropdownMenu";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import { useEnvironment } from "@/lib/environments/environments";
import { createSurvey, deleteSurvey, duplicateSurvey, useSurveys } from "@/lib/surveys/surveys";
import { Badge, ErrorComponent } from "@formbricks/ui";
import {
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  LinkIcon,
  PencilSquareIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
  ArrowUpOnSquareStackIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import TemplateList from "./templates/TemplateList";
import { useEffect } from "react";
import { changeEnvironment } from "@/lib/environments/changeEnvironments";

export default function SurveysList({ environmentId }) {
  const router = useRouter();
  const { surveys, mutateSurveys, isLoadingSurveys, isErrorSurveys } = useSurveys(environmentId);
  const { environment, isErrorEnvironment, isLoadingEnvironment } = useEnvironment(environmentId);

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isCreateSurveyLoading, setIsCreateSurveyLoading] = useState(false);

  const [activeSurvey, setActiveSurvey] = useState("" as any);
  const [activeSurveyIdx, setActiveSurveyIdx] = useState("" as any);
  const [otherEnvironment, setOtherEnvironment] = useState("" as any);

  useEffect(() => {
    if (environment) {
      setOtherEnvironment(environment.product.environments.find((e) => e.type !== environment.type));
    }
  }, [environment]);

  const newSurvey = async () => {
    router.push(`/environments/${environmentId}/surveys/templates`);
  };

  const newSurveyFromTemplate = async (template: Template) => {
    setIsCreateSurveyLoading(true);
    const augmentedTemplate = {
      ...template.preset,
      type: environment?.widgetSetupCompleted ? "web" : "link",
    };
    try {
      const survey = await createSurvey(environmentId, augmentedTemplate);
      router.push(`/environments/${environmentId}/surveys/${survey.id}/edit`);
    } catch (e) {
      toast.error("An error occured creating a new survey");
      setIsCreateSurveyLoading(false);
    }
  };

  const deleteSurveyAction = async (survey, surveyIdx) => {
    try {
      await deleteSurvey(environmentId, survey.id);
      // remove locally
      const updatedsurveys = JSON.parse(JSON.stringify(surveys));
      updatedsurveys.splice(surveyIdx, 1);
      mutateSurveys(updatedsurveys);
      setDeleteDialogOpen(false);
      toast.success("Survey deleted successfully.");
    } catch (error) {
      console.error(error);
    }
  };

  const duplicateSurveyAndRefresh = async (surveyId) => {
    try {
      await duplicateSurvey(environmentId, surveyId);
      mutateSurveys();
      toast.success("Survey duplicated successfully.");
    } catch (error) {
      toast.error("Failed to duplicate the survey.");
    }
  };

  const copyToOtherEnvironment = async (surveyId) => {
    try {
      await duplicateSurvey(environmentId, surveyId, otherEnvironment.id);
      if (otherEnvironment.type === "production") {
        toast.success("Survey copied to production env.");
      } else if (otherEnvironment.type === "development") {
        toast.success("Survey copied to development env.");
      }
      changeEnvironment(otherEnvironment.type, environment, router);
    } catch (error) {
      toast.error(`Failed to copy to ${otherEnvironment.type}`);
    }
  };

  if (isLoadingSurveys || isLoadingEnvironment) {
    return <LoadingSpinner />;
  }

  if (isErrorSurveys || isErrorEnvironment) {
    return <ErrorComponent />;
  }

  if (surveys.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col py-12">
        {isCreateSurveyLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="px-7 pb-4">
              <h1 className="text-3xl font-extrabold text-slate-700">
                You&apos;re all set! Time to create your first survey.
              </h1>
            </div>
            <TemplateList
              environmentId={environmentId}
              onTemplateClick={(template) => {
                newSurveyFromTemplate(template);
              }}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 place-content-stretch gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 ">
        <button onClick={() => newSurvey()}>
          <li className="col-span-1 h-56">
            <div className="delay-50 flex h-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-slate-900 to-slate-800 font-light text-white shadow transition ease-in-out hover:scale-105 hover:from-slate-800 hover:to-slate-700">
              <div id="main-cta" className="px-4 py-8 sm:p-14 xl:p-10">
                <PlusIcon className="stroke-thin mx-auto h-14 w-14" />
                Create Survey
              </div>
            </div>
          </li>
        </button>
        {surveys
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((survey, surveyIdx) => (
            <li key={survey.id} className="relative col-span-1 h-56">
              <div className="delay-50 flex h-full flex-col justify-between rounded-md bg-white shadow transition ease-in-out hover:scale-105">
                <div className="px-6 py-4">
                  <Badge
                    StartIcon={survey.type === "link" ? LinkIcon : ComputerDesktopIcon}
                    startIconClassName="mr-2"
                    text={
                      survey.type === "link"
                        ? "Link Survey"
                        : survey.type === "web"
                        ? "In-Product Survey"
                        : ""
                    }
                    type="gray"
                    size={"tiny"}
                    className="font-base"></Badge>
                  <p className="my-2 line-clamp-3 text-lg">{survey.name}</p>
                </div>
                <Link
                  href={
                    survey.status === "draft"
                      ? `/environments/${environmentId}/surveys/${survey.id}/edit`
                      : `/environments/${environmentId}/surveys/${survey.id}/summary`
                  }
                  className="absolute h-full w-full"></Link>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between px-4 py-2 text-right sm:px-6">
                    <div className="flex items-center">
                      {survey.status !== "draft" && (
                        <>
                          <SurveyStatusIndicator
                            status={survey.status}
                            tooltip
                            environmentId={environmentId}
                          />
                          <p className="ml-2 text-xs text-slate-400 ">{survey._count?.responses} responses</p>
                        </>
                      )}
                      {survey.status === "draft" && (
                        <span className="text-xs italic text-slate-400">Draft</span>
                      )}
                    </div>

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
                                  href={`${window.location.protocol}//${window.location.host}/s/${survey.id}?preview=true`}
                                  target="_blank">
                                  <EyeIcon className="mr-2 h-4 w-4" />
                                  Preview Survey
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <button
                                  className="flex w-full items-center"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `${window.location.protocol}//${window.location.host}/s/${survey.id}`
                                    );
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
                                setActiveSurvey(survey);
                                setActiveSurveyIdx(surveyIdx);
                                setDeleteDialogOpen(true);
                              }}>
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Delete
                            </button>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </li>
          ))}
      </ul>

      <DeleteDialog
        deleteWhat="Survey"
        open={isDeleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        onDelete={() => deleteSurveyAction(activeSurvey, activeSurveyIdx)}
        text="Are you sure you want to delete this survey and all of its responses? This action cannot be undone."
      />
    </>
  );
}
