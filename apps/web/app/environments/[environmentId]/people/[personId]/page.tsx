"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { BackIcon } from "@/components/ui/icons/BackIcon";
import { usePerson } from "@/lib/people";
import { onlyUnique } from "@/lib/utils";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export default function PersonPage({ params }) {
  const router = useRouter();
  const { person, isLoadingPerson, isErrorPerson } = usePerson(params.environmentId, params.personId);

  const formsParticipated = useMemo(() => {
    if (person && "submissions" in person) {
      return person.submissions.map((s) => s.formId).filter(onlyUnique).length;
    }
  }, [person]);

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

  console.log("person", JSON.stringify(person, null, 2));
  console.log("person", JSON.stringify(person, null, 2));

  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <button className="inline-flex pt-5 text-sm text-slate-500" onClick={() => router.back()}>
          <BackIcon className="mr-2 h-5 w-5" />
          Back
        </button>
        <div className="flex items-baseline justify-between border-b border-slate-200 pt-4 pb-6">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">{person.email}</h1>
          <div className="flex items-center space-x-3">
            <Button variant="primary" href={`mailto:${person.email}`}>
              Send email
            </Button>
            <button /* onClick={deletePerson(personId)} */>
              <TrashIcon className="h-5 w-5 text-slate-500 hover:text-red-500" />
            </button>
          </div>
        </div>

        <section className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-4">
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-700">Properties</h2>
              {/*                   {"name" in person.data && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Name</dt>
                      <dd className="mt-1 text-sm text-slate-900">{person.data.name}</dd>
                    </div>
                  )} */}
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
              <div>
                <dt className="text-sm font-medium text-slate-500">Number of forms participated</dt>
                <dd className="mt-1 text-sm text-slate-900">{formsParticipated}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Number of form submissions</dt>
                {/* <dd className="mt-1 text-sm text-slate-900">{person.submissions.length}</dd> */}
              </div>
            </div>

            {/* <div className="md:col-span-3">
                  {person.submissions.length === 0 ? (
                    <EmptyPageFiller
                      alertText="You haven't received any submissions yet."
                      hintText="Embed the feedback widget on your website to start receiving feedback."
                      borderStyles="border-4 border-dotted border-red">
                      <InboxIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                    </EmptyPageFiller>
                  ) : (
                    <>
                      {person.submissions.map((submission, submissionIdx) => (
                        <li key={submission.id} className="list-none">
                          <div className="relative pb-8">
                            {submissionIdx !== person.submissions.length - 1 ? (
                              <span
                                className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                                aria-hidden="true"
                              />
                            ) : null}
                            <div className="relative flex space-x-3">
                              <div className="w-full overflow-hidden rounded-lg bg-white shadow">
                                <div className="px-4 py-5 sm:p-6">
                                  <div className="flex w-full justify-between">
                                    {submission.form.type === "pmf" && (
                                      <div className="mr-4 flex items-center text-lg font-bold text-slate-700">
                                        <PMFIcon className="mr-4 h-8 w-8" />
                                        Product-Market Fit Survey
                                      </div>
                                    )}
                                    {submission.form.type === "feedback" && (
                                      <div className="mr-4 flex items-center text-lg font-bold text-slate-700">
                                        <FeedbackIcon className="mr-4 h-8 w-8" />
                                        Feedback Box
                                      </div>
                                    )}
                                    {submission.form.type === "custom" && (
                                      <div className="mr-4 flex items-center text-lg font-bold text-slate-700">
                                        <FormIcon className="mr-4 h-8 w-8" />
                                        Custom Survey
                                      </div>
                                    )}

                                    <div className="text-sm text-slate-400">
                                      <time dateTime={convertDateTimeString(submission.createdAt)}>
                                        {convertDateTimeString(submission.createdAt)}
                                      </time>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <p className="whitespace-pre-wrap text-sm text-slate-500">
                                      {Object.entries(
                                        MergeWithSchema(submission.data, submission.form.schema)
                                      ).map(([key, value]) => (
                                        <li key={key} className="py-5">
                                          <p className="text-sm font-semibold text-slate-800">{key}</p>
                                          <p
                                            className={clsx(
                                              value ? "text-slate-600" : "text-slate-400",
                                              "whitespace-pre-line pt-1 text-sm text-slate-600"
                                            )}>
                                             value.toString() 
                                          </p>
                                        </li>
                                      ))}
                                    </p>
                                  </div>
                                </div>
                                <div className=" bg-slate-50 p-4 sm:p-6">
                                  <div className="flex w-full justify-between gap-4">
                                    <div>
                                      <p className="text-sm font-thin text-slate-500">Device</p>
                                      <p className="text-sm text-slate-500">
                                        {parseUserAgent(submission.meta.userAgent)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </>
                  )}
                </div> */}
          </div>
        </section>
      </main>
    </div>
  );
}
