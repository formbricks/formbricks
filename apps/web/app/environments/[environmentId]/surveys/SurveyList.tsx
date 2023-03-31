"use client";

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
import { deleteSurvey, useSurveys } from "@/lib/surveys/surveys";
import { ErrorComponent } from "@formbricks/ui";
import { PlusIcon } from "@heroicons/react/24/outline";
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export default function SurveysList({ environmentId }) {
  const router = useRouter();
  const { surveys, mutateSurveys, isLoadingSurveys, isErrorSurveys } = useSurveys(environmentId);

  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [activeSurvey, setActiveSurvey] = useState("" as any);
  const [activeSurveyIdx, setActiveSurveyIdx] = useState("" as any);

  const newSurvey = async () => {
    router.push(`/environments/${environmentId}/surveys/templates`);
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

  if (isLoadingSurveys) {
    return <LoadingSpinner />;
  }

  if (isErrorSurveys) {
    return <ErrorComponent />;
  }

  return (
    <>
      <ul className="grid grid-cols-2 place-content-stretch gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-6 ">
        <button onClick={() => newSurvey()}>
          <li className="col-span-1 h-56">
            <div className="from-brand-light to-brand-dark delay-50 flex h-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-b font-light text-white shadow transition ease-in-out hover:scale-105">
              <div className="px-4 py-8 sm:p-14 xl:p-10">
                <PlusIcon className="stroke-thin mx-auto h-14 w-14" />
                Create Survey
              </div>
            </div>
          </li>
        </button>
        {/*  {surveys.length === 0 && (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-slate-200 bg-slate-100 p-2">
            <p className="text-center text-xs text-slate-500">Kinda lost?</p>
            <video width="100" height="120" loop autoPlay className="rounded">
              <source src="/video/lost-sw.mp4" type="video/mp4" />
              No GIF support
            </video>
            <Button
              variant="secondary"
              onClick={() => setVideoDialogOpen(true)}
              className="hover:bg-slate-300">
              Play video
            </Button>

            <Modal open={isVideoDialogOpen} setOpen={setVideoDialogOpen}>
              <ResponsiveVideo src="/video/walkthrough-v1.mp4" />
            </Modal>
          </div>
        )} */}
        {surveys
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((survey, surveyIdx) => (
            <li key={survey.id} className="relative col-span-1 h-56">
              <div className="delay-50 flex h-full flex-col justify-between rounded-md bg-white shadow transition ease-in-out hover:scale-105">
                <div className="p-6">
                  <p className="line-clamp-3 text-lg">{survey.name}</p>
                </div>
                <Link
                  href={
                    survey.status === "draft"
                      ? `/environments/${environmentId}/surveys/${survey.id}/edit`
                      : `/environments/${environmentId}/surveys/${survey.id}/summary`
                  }
                  className="absolute h-full w-full"></Link>
                <div className="divide-y divide-slate-100 ">
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
      />
    </>
  );
}
