import { useEffect, useState } from "react";

import { RadioGroup } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/solid";
import { getEventName } from "../../lib/events";
import { useSubmissionSessions } from "../../lib/submissionSessions";
import { SubmissionSession } from "../../lib/types";
import { convertDateTimeString, convertTimeString } from "../../lib/utils";
import SubmissionDisplay from "./SubmissionDisplay";
import DownloadResponses from "./DownloadResponses";
import Loading from "../Loading";
import { TrashIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

type ResultsResponseProps = {
  formId: string;
};

export default function ResultsResponses({ formId }: ResultsResponseProps) {
  const { submissionSessions, isLoadingSubmissionSessions, mutateSubmissionSessions } =
    useSubmissionSessions(formId);
  const [activeSubmissionSession, setActiveSubmissionSession] = useState<SubmissionSession | null>(null);

  const handleDelete = async (submissionSession: SubmissionSession) => {
    try {
      await fetch(`/api/forms/${formId}/submissionSessions/${submissionSession.id}`, {
        method: "DELETE",
      });

      await mutateSubmissionSessions();
      setActiveSubmissionSession(null);
      toast("Successfully deleted");
    } catch (error) {
      toast(error);
    }
  };

  useEffect(() => {
    if (!isLoadingSubmissionSessions && submissionSessions.length > 0) {
      setActiveSubmissionSession(submissionSessions[0]);
    }
  }, [isLoadingSubmissionSessions, submissionSessions]);

  if (isLoadingSubmissionSessions) {
    return <Loading />;
  }

  return (
    <div className="max-w-screen mx-auto flex h-full w-full flex-1 flex-col overflow-visible">
      <div className="relative z-0 flex h-full flex-1 overflow-visible">
        <main className="relative z-0 mb-32 flex-1 overflow-y-auto focus:outline-none xl:order-last">
          <div className="overflow-visible sm:rounded-lg">
            {!activeSubmissionSession ? (
              <button
                type="button"
                className="relative mx-auto mt-8 block w-96 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                <span className="mt-2 block text-sm font-medium text-gray-500">
                  Select a response on the left to see the details here
                </span>
              </button>
            ) : (
              <>
                <div className="bg-white px-4 py-5 shadow sm:px-12 sm:pb-4 sm:pt-12">
                  <div className="grid grid-cols-2 gap-8 divide-x">
                    <div className="flow-root">
                      <h1 className="mb-8 text-gray-700">
                        {convertDateTimeString(activeSubmissionSession.createdAt)}
                      </h1>
                      <SubmissionDisplay
                        key={activeSubmissionSession.id}
                        submissionSession={activeSubmissionSession}
                        formId={formId}
                      />
                    </div>
                    <div className="hidden pl-10 md:flow-root">
                      <h1 className="mb-8 text-gray-700">Session Activity</h1>
                      <ul role="list" className="-mb-8">
                        {activeSubmissionSession.events.map((event, eventIdx) => (
                          <li key={event.id}>
                            <div className="relative pb-8">
                              {eventIdx !== activeSubmissionSession.events.length - 1 ? (
                                <span
                                  className="bg-ui-gray-light absolute top-4 left-4 -ml-px h-full w-0.5"
                                  aria-hidden="true"
                                />
                              ) : null}
                              <div className="relative flex space-x-3">
                                <div>
                                  <span
                                    className={classNames(
                                      "bg-red-200",
                                      "flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white"
                                    )}>
                                    <CheckIcon className="h-5 w-5 text-white" aria-hidden="true" />
                                  </span>
                                </div>
                                <div className="flex min-w-0 flex-1 flex-wrap justify-between gap-4 pt-1.5">
                                  <div>
                                    <p className="text-sm text-gray-500">
                                      {getEventName(event.type)}
                                      {/* <span className="font-medium text-gray-900">
                                      {event.data.pageName || ""}
                                    </span> */}
                                    </p>
                                  </div>
                                  <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                    <time dateTime={event.createdAt}>
                                      {convertTimeString(event.createdAt)}
                                    </time>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="w-full">
                  <button
                    className="flex w-full items-center justify-center gap-2 border border-transparent bg-gray-300 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500 focus:outline-none"
                    onClick={() => {
                      if (
                        confirm("Are you sure you want to delete this submission? It will be gone forever!")
                      ) {
                        handleDelete(activeSubmissionSession);
                      }
                    }}>
                    <TrashIcon className="h-4 w-4" />
                    Delete Submission
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
        <aside className="border-ui-gray-light order-first flex h-full flex-1 flex-shrink-0 flex-col border-r md:w-96 md:flex-none">
          <DownloadResponses formId={formId} />
          <div className="pt-4 pb-2">
            <h2 className="px-5 text-lg font-medium text-gray-900">Responses</h2>
          </div>
          {submissionSessions.length === 0 ? (
            <p className="mt-3 px-5 text-sm text-gray-500">No responses yet</p>
          ) : (
            <RadioGroup
              value={activeSubmissionSession}
              onChange={setActiveSubmissionSession}
              className="mb-32 min-h-0 flex-1 overflow-y-auto shadow-inner"
              as="div">
              <div className="relative">
                <ul className="divide-ui-gray-light relative z-0 divide-y">
                  {submissionSessions.map((submissionSession) => (
                    <RadioGroup.Option
                      key={submissionSession.id}
                      value={submissionSession}
                      className={({ checked }) =>
                        classNames(
                          checked ? "bg-gray-100" : "",
                          "relative flex items-center space-x-3 px-6 py-5 "
                        )
                      }>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setActiveSubmissionSession(submissionSession)}
                          className="w-full text-left focus:outline-none">
                          {/* Extend touch target to entire panel */}
                          <span className="absolute inset-0" aria-hidden="true" />
                          <p className="text-sm font-medium text-gray-900">
                            {convertDateTimeString(submissionSession.createdAt)}
                          </p>
                          <p className="truncate text-sm text-gray-500">
                            {submissionSession.events.length} events
                          </p>
                        </button>
                      </div>
                    </RadioGroup.Option>
                  ))}
                </ul>
              </div>
            </RadioGroup>
          )}
        </aside>
      </div>
    </div>
  );
}
