"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import GoBackButton from "@/components/shared/GoBackButton";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { deletePerson, usePerson } from "@/lib/people/people";
import { capitalizeFirstLetter } from "@/lib/utils";
import { ErrorComponent } from "@formbricks/ui";
import { ArrowsUpDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import ActivityFeed from "./ActivityFeed";
import ResponseFeed from "./ResponsesFeed";

interface PersonDetailsProps {
  environmentId: string;
  personId: string;
}

export default function PersonDetails({ environmentId, personId }: PersonDetailsProps) {
  const router = useRouter();
  const { person, isLoadingPerson, isErrorPerson } = usePerson(environmentId, personId);

  const [responsesAscending, setResponsesAscending] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityAscending, setActivityAscending] = useState(true);

  const personEmail = useMemo(
    () => person?.attributes?.find((attribute) => attribute.attributeClass.name === "email"),
    [person]
  );
  const personUserId = useMemo(
    () => person?.attributes?.find((attribute) => attribute.attributeClass.name === "userId"),
    [person]
  );

  const otherAttributes = useMemo(
    () =>
      person?.attributes?.filter(
        (attribute) =>
          attribute.attributeClass.name !== "email" &&
          attribute.attributeClass.name !== "userId" &&
          !attribute.attributeClass.archived
      ) as any[],
    [person]
  );

  const toggleSortResponses = () => {
    setResponsesAscending(!responsesAscending);
  };

  const handleDeletePerson = async () => {
    await deletePerson(environmentId, personId);
    router.push(`/environments/${environmentId}/people`);
    toast.success("Person deleted successfully.");
  };

  const toggleSortActivity = () => {
    setActivityAscending(!activityAscending);
  };

  if (isLoadingPerson) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorPerson) {
    return <ErrorComponent />;
  }

  return (
    <>
      <GoBackButton />
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-6 pt-4">
        <h1 className="ph-no-capture text-4xl font-bold tracking-tight text-slate-900">
          {personEmail ? <span>{personEmail.value}</span> : <span>{person.id}</span>}
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
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-700">Attributes</h2>
            <div>
              <dt className="text-sm font-medium text-slate-500">Email</dt>
              <dd className="ph-no-capture mt-1 text-sm text-slate-900">
                {personEmail ? (
                  <span>{personEmail?.value}</span>
                ) : (
                  <span className="text-slate-300">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">User Id</dt>
              <dd className="ph-no-capture mt-1 text-sm text-slate-900">
                {personUserId ? (
                  <span>{personUserId?.value}</span>
                ) : (
                  <span className="text-slate-300">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Formbricks Id (internal)</dt>
              <dd className="ph-no-capture mt-1 text-sm text-slate-900">{person.id}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-slate-500">Sessions</dt>
              <dd className="mt-1 text-sm text-slate-900">{person.sessions.length}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Responses</dt>
              <dd className="mt-1 text-sm text-slate-900">{person.responses.length}</dd>
            </div>
            {otherAttributes.map((attribute) => (
              <div key={attribute.attributeClass.name}>
                <dt className="text-sm font-medium text-slate-500">
                  {capitalizeFirstLetter(attribute.attributeClass.name)}
                </dt>
                <dd className="mt-1 text-sm text-slate-900">{attribute.value}</dd>
              </div>
            ))}
          </div>

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

            <ResponseFeed person={person} sortByDate={responsesAscending} environmentId={environmentId} />
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
              sessions={person.sessions}
              attributes={person.attributes}
              displays={person.displays}
              responses={person.responses}
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
