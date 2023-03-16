"use client";

import GoBackButton from "@/components/shared/GoBackButton";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { usePerson } from "@/lib/people";
import { onlyUnique } from "@/lib/utils";
import { ArrowsUpDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import ActivityFeed from "./ActivityFeed";
import ResponseFeed from "./ResponsesFeed";

interface PersonDetailsProps {
  environmentId: string;
  personId: string;
}

export default function PersonDetails({ environmentId, personId }: PersonDetailsProps) {
  const { person, isLoadingPerson, isErrorPerson } = usePerson(environmentId, personId);

  const formsParticipated = useMemo(() => {
    if (person && "responses" in person) {
      return person.responses.map((response) => Object.keys(response.data)[0]).filter(onlyUnique).length;
    }
  }, [person]);

  const [responsesAscending, setResponsesAscending] = useState(true);

  const toggleSortResponses = () => {
    setResponsesAscending(!responsesAscending);
  };

  const [activityAscending, setActivityAscending] = useState(true);

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
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  /*  
  console.log("person.sessions", JSON.stringify(person.sessions, null, 2));
  console.log("person.attributes", JSON.stringify(person.attributes, null, 2));
 */
  return (
    <>
      <GoBackButton />
      <div className="flex items-baseline justify-between border-b border-slate-200 pt-4 pb-6">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{person.email}</h1>
        <div className="flex items-center space-x-3">
          <button /* onClick={deletePerson(personId)} */>
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
              <dd className="mt-1 text-sm text-slate-900">{person.email}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-slate-500">User Id</dt>
              <dd className="mt-1 text-sm text-slate-900">{person.userId}</dd>
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
            {/* {Object.entries(person.data).map(
            ([key, value]) =>
              !["name", "email"].includes(key) && (
                <div>
                  <dt className="text-sm font-medium text-slate-500">{key}</dt>
                  <dd className="mt-1 text-sm text-slate-900"> value.toString() </dd>
                </div>
              )
          )} */}
            <hr className="text-slate-600" />
            <h2 className="font-bold text-slate-700">Custom Attributes</h2>
            <div>
              <dt className="text-sm font-medium text-slate-500">Number of forms participated</dt>
              <dd className="mt-1 text-sm text-slate-900">{formsParticipated}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Number of form submissions</dt>
              <dd className="mt-1 text-sm text-slate-900">{person.responses.length}</dd>
            </div>
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
            />
          </div>
        </div>
      </section>
    </>
  );
}
