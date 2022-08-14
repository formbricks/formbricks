import { useEffect, useState } from "react";

import { RadioGroup } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/solid";
import { getEventName } from "../../lib/events";
import { useSubmissionSessions } from "../../lib/submissionSessions";
import { SubmissionSession } from "../../lib/types";
import { convertDateTimeString, convertTimeString } from "../../lib/utils";
import SubmissionDisplay from "./SubmissionDisplay";
import DownloadResponses from "./DownloadResponses";
import Loading from "../Loading";
import { TrashIcon } from "@heroicons/react/outline";
import { toast } from "react-toastify";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

type ResultsResponseProps = {
  formId: string;
};

export default function ResultsResponses({ formId }: ResultsResponseProps) {
  const {
    submissionSessions,
    isLoadingSubmissionSessions,
    mutateSubmissionSessions,
  } = useSubmissionSessions(formId);
  const [activeSubmissionSession, setActiveSubmissionSession] =
    useState<SubmissionSession | null>(null);

  const handleDelete = async (submissionSession: SubmissionSession) => {
    try {
      await fetch(
        `/api/forms/${formId}/submissionSessions/${submissionSession.id}`,
        {
          method: "DELETE",
        }
      );

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
    <div className="flex flex-col flex-1 w-full h-full mx-auto overflow-visible max-w-screen">
      <div className="relative z-0 flex flex-1 overflow-visible">
        <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none xl:order-last">
          <div className="overflow-visible sm:rounded-lg">
            {!activeSubmissionSession ? (
              <button
                type="button"
                className="relative block p-12 mx-auto mt-8 text-center border-2 border-gray-300 border-dashed rounded-lg w-96 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="block mt-2 text-sm font-medium text-gray-500">
                  Select a response on the left to see the details here
                </span>
              </button>
            ) : (
              <>
                <div className="px-4 py-5 bg-white shadow sm:px-12 sm:pb-4 sm:pt-12">
                  <div className="grid grid-cols-2 gap-8 divide-x">
                    <div className="flow-root">
                      <h1 className="mb-8 text-gray-700">
                        {convertDateTimeString(
                          activeSubmissionSession.createdAt
                        )}
                      </h1>
                      <SubmissionDisplay
                        key={activeSubmissionSession.id}
                        submissionSession={activeSubmissionSession}
                        formId={formId}
                      />
                    </div>
                    <div className="flow-root pl-10">
                      <h1 className="mb-8 text-gray-700">Session Activity</h1>
                      <ul role="list" className="-mb-8">
                        {activeSubmissionSession.events.map(
                          (event, eventIdx) => (
                            <li key={event.id}>
                              <div className="relative pb-8">
                                {eventIdx !==
                                activeSubmissionSession.events.length - 1 ? (
                                  <span
                                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-ui-gray-light"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                <div className="relative flex space-x-3">
                                  <div>
                                    <span
                                      className={classNames(
                                        "bg-red-200",
                                        "h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white"
                                      )}
                                    >
                                      <CheckIcon
                                        className="w-5 h-5 text-white"
                                        aria-hidden="true"
                                      />
                                    </span>
                                  </div>
                                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between flex-wrap gap-4">
                                    <div>
                                      <p className="text-sm text-gray-500">
                                        {getEventName(event.type)}
                                        {/* <span className="font-medium text-gray-900">
                                      {event.data.pageName || ""}
                                    </span> */}
                                      </p>
                                    </div>
                                    <div className="text-sm text-right text-gray-500 whitespace-nowrap">
                                      <time dateTime={event.createdAt}>
                                        {convertTimeString(event.createdAt)}
                                      </time>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="w-full">
                  <button
                    className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-300 border border-transparent shadow-sm hover:bg-red-500 focus:outline-none"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to delete this submission? It will be gone forever!"
                        )
                      ) {
                        handleDelete(activeSubmissionSession);
                      }
                    }}
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete Submission
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
        <aside className="flex-shrink-0 hidden border-r border-ui-gray-light md:order-first md:flex md:flex-col w-96">
          <DownloadResponses formId={formId} />
          <div className="pt-6 pb-1">
            <h2 className="px-5 text-lg font-medium text-gray-900">
              Responses
            </h2>
          </div>
          {submissionSessions.length === 0 ? (
            <p className="px-5 mt-3 text-sm text-gray-500">No responses yet</p>
          ) : (
            <RadioGroup
              value={activeSubmissionSession}
              onChange={setActiveSubmissionSession}
              className="flex-1 min-h-0 overflow-y-auto"
            >
              <div className="relative">
                <ul className="relative z-0 divide-y divide-ui-gray-light">
                  {submissionSessions.map((submissionSession) => (
                    <RadioGroup.Option
                      key={submissionSession.id}
                      value={submissionSession}
                      className={({ checked }) =>
                        classNames(
                          checked ? "bg-gray-100" : "",
                          "relative flex items-center px-6 py-5 space-x-3 "
                        )
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() =>
                            setActiveSubmissionSession(submissionSession)
                          }
                          className="w-full text-left focus:outline-none"
                        >
                          {/* Extend touch target to entire panel */}
                          <span
                            className="absolute inset-0"
                            aria-hidden="true"
                          />
                          <p className="text-sm font-medium text-gray-900">
                            {convertDateTimeString(submissionSession.createdAt)}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
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
