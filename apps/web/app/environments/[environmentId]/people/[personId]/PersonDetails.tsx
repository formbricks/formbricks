"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import GoBackButton from "@/components/shared/GoBackButton";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ErrorComponent from "@/components/ui/ErrorComponent";
import { deletePerson, usePerson } from "@/lib/people/people";
import { capitalizeFirstLetter } from "@/lib/utils";
import { ArrowsUpDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

  /*   const formsParticipated = useMemo(() => {
    if (person && "responses" in person) {
      return person.responses.map((response) => Object.keys(response.data)[0]).filter(onlyUnique).length;
    }
  }, [person]); */

  const [responsesAscending, setResponsesAscending] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const toggleSortResponses = () => {
    setResponsesAscending(!responsesAscending);
  };

  const handleDeletePerson = async () => {
    await deletePerson(environmentId, personId);
    router.push(`/environments/${environmentId}/people`);
    toast.success("Person deleted successfully.");
  };

  const [activityAscending, setActivityAscending] = useState(true);

  const toggleSortActivity = () => {
    setActivityAscending(!activityAscending);
  };

  const [attributeMap, setAttributeMap] = useState<AttributeObject[]>([]);

  interface AttributeObject {
    type: string;
    createdAt: string;
    updatedAt: string;
    attributeLabel: string;
    attributeValue: string;
  }

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
      <div className="flex items-baseline justify-between border-b border-slate-200 pt-4 pb-6">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          {person.email ? <span>{person.email}</span> : <span>{person.id}</span>}
        </h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setDeleteDialogOpen(true);
            }}>
            <TrashIcon className="h-5 w-5 text-slate-500 hover:text-red-500" />
          </button>
        </div>
      </div>
      <section className="pt-6 pb-24">
        <div className="grid grid-cols-1 gap-x-8  md:grid-cols-4">
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-700">Attributes</h2>
            <div>
              <dt className="text-sm font-medium text-slate-500">Email</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {person.email ? (
                  <span>{person.email}</span>
                ) : (
                  <span className="text-slate-300">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">User Id</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {person.userId ? (
                  <span>{person.Id}</span>
                ) : (
                  <span className="text-slate-300">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Formbricks Id (internal)</dt>
              <dd className="mt-1 text-sm text-slate-900">{person.id}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-slate-500">Sessions</dt>
              <dd className="mt-1 text-sm text-slate-900">{person.sessions.length}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Responses</dt>
              <dd className="mt-1 text-sm text-slate-900">{person.responses.length}</dd>
            </div>
            {attributeMap.map((attribute) => (
              <div key={attribute.attributeLabel}>
                <dt className="text-sm font-medium text-slate-500">
                  {capitalizeFirstLetter(attribute.attributeLabel)}
                </dt>
                <dd className="mt-1 text-sm text-slate-900">{attribute.attributeValue.toString()}</dd>
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
              attributeMap={attributeMap}
              setAttributeMap={setAttributeMap}
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
