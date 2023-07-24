"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import GoBackButton from "@/components/shared/GoBackButton";
import { ArrowsUpDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import ActivityFeed from "./ActivityFeed";
import ResponseFeed from "./ResponsesFeed";
import { TPersonWithDetailedAttributes } from "@formbricks/types/v1/people";
import { TDisplaysWithSurveyName } from "@formbricks/types/v1/displays";
import { TSessionWithActions } from "@formbricks/types/v1/sessions";
import { TResponseWithSurveyQuestions } from "@formbricks/types/v1/responses";
import { deletePerson } from "@formbricks/lib/services/person";

interface PersonDetailsProps {
  environmentId: string;
  personWithAttributes: TPersonWithDetailedAttributes;
  sessionsWithActions: TSessionWithActions[];
  responsesWithSurveyData: TResponseWithSurveyQuestions[];
  displays: TDisplaysWithSurveyName[];
  children: React.ReactNode;
}

export default function PersonDetails({
  environmentId,
  personWithAttributes,
  sessionsWithActions,
  responsesWithSurveyData,
  displays,
  children,
}: PersonDetailsProps) {
  const router = useRouter();

  const [responsesAscending, setResponsesAscending] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityAscending, setActivityAscending] = useState(true);

  const personEmail = personWithAttributes?.attributes?.find((attribute) => attribute.name === "email");

  const toggleSortResponses = () => {
    setResponsesAscending(!responsesAscending);
  };

  const handleDeletePerson = async () => {
    await deletePerson(personWithAttributes.id);
    router.push(`/environments/${environmentId}/people`);
    toast.success("Person deleted successfully.");
  };

  const toggleSortActivity = () => {
    setActivityAscending(!activityAscending);
  };

  return (
    <>
      <GoBackButton />
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-6 pt-4">
        <h1 className="ph-no-capture text-4xl font-bold tracking-tight text-slate-900">
          {personEmail ? <span>{personEmail.value}</span> : <span>{personWithAttributes?.id}</span>}
        </h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setDeleteDialogOpen(true);
            }}>
            <TrashIcon className="h-5 w-5 text-slate-500 hover:text-red-700" />
          </button>
        </div>
      </div>
      <section className="pb-24 pt-6">
        <div className="grid grid-cols-1 gap-x-8  md:grid-cols-4">
          {children}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between pb-6">
              <h2 className="text-lg font-bold text-slate-700">Responses</h2>
              <div className="text-right">
                <button
                  onClick={toggleSortResponses}
                  className="hover:text-brand-dark flex items-center px-1 text-slate-800">
                  <ArrowsUpDownIcon className="inline h-4 w-4" />
                </button>
              </div>
            </div>
            <ResponseFeed
              responses={responsesWithSurveyData}
              sortByDate={responsesAscending}
              environmentId={environmentId}
            />
          </div>
          <div className="md:col-span-1">
            <div className="flex items-center justify-between pb-6">
              <h2 className="text-lg font-bold text-slate-700">Activity Timeline</h2>
              <div className="text-right">
                <button
                  onClick={toggleSortActivity}
                  className="hover:text-brand-dark flex items-center px-1 text-slate-800">
                  <ArrowsUpDownIcon className="inline h-4 w-4" />
                </button>
              </div>
            </div>

            <ActivityFeed
              sessions={sessionsWithActions}
              attributes={personWithAttributes?.attributes}
              displays={displays}
              sortByDate={activityAscending}
              environmentId={environmentId}
            />
          </div>
        </div>
      </section>
      <DeleteDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        deleteWhat="person"
        onDelete={handleDeletePerson}
      />
    </>
  );
}
