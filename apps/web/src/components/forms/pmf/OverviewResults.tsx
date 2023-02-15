"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { getOptionLabelMap, useSubmissions } from "@/lib/submissions";
import { Pie } from "@formbricks/charts";
import { InboxIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";
import { SubmissionCounter } from "../shared/SubmissionCounter";
import Link from "next/link";

export default function OverviewResults() {
  const router = useRouter();
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.organisationId?.toString()
  );
  const { submissions, isLoadingSubmissions, isErrorSubmissions } = useSubmissions(
    router.query.organisationId?.toString(),
    router.query.formId?.toString()
  );
  const [numTotalSubmissions, setNumTotalSubmissions] = useState(0);
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);

  const labelMap = useMemo(() => {
    if (form) {
      return getOptionLabelMap(form.schema);
    }
  }, [form]);

  if (isLoadingSubmissions || isLoadingForm) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorSubmissions || isErrorForm) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  const questions = [
    {
      label: "What is the main benefit you receive from our service?",
      name: "mainBenefit",
    },
    {
      label: "How can we improve our service for you?",
      name: "improvement",
    },
    {
      label: "What type of people would benefit most from using our service?",
      name: "benefitingUsers",
    },
  ];

  return (
    <div>
      <div>
        <section aria-labelledby="filters" className="max-w-8xl mx-auto py-8 pt-6 pb-24 ">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-4">
            <div>
              <SubmissionCounter
                numFilteredSubmissions={filteredSubmissions.length}
                numTotalSubmissions={numTotalSubmissions}
              />
              <FilterNavigation
                submissions={submissions}
                setFilteredSubmissions={setFilteredSubmissions}
                setNumTotalSubmissions={setNumTotalSubmissions}
              />
            </div>

            {/* Submission grid */}

            <div className="max-w-7xl md:col-span-3">
              {submissions.length === 0 ? (
                <EmptyPageFiller
                  alertText="You haven't received any submissions yet."
                  hintText="Embed the PMF survey on your website to start gathering insights."
                  borderStyles="border-4 border-dotted border-red">
                  <InboxIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                </EmptyPageFiller>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-white p-2">
                      <h3 className="text-sm font-medium text-slate-800">Disappointment Level</h3>
                      <Pie
                        submissions={filteredSubmissions}
                        schema={form.schema}
                        fieldName={"disappointment"}
                      />
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-lg bg-white p-2">
                      <h3 className="text-sm font-medium text-slate-800">Selected Segment</h3>
                      <Pie submissions={filteredSubmissions} schema={form.schema} fieldName={"role"} />
                    </div>
                  </div>
                  {questions.map((question) => (
                    <div key={question.name} className="my-4 rounded-lg bg-white">
                      <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                        {question.label}
                      </div>
                      <div className="grid grid-cols-5 gap-2 border-t border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                        <div className="col-span-3">Response</div>
                        <div>Disappointment Level</div>
                        <div>Job</div>
                      </div>
                      <div className="max-h-96 overflow-auto">
                        {filteredSubmissions
                          .filter((s) => question.name in s.data)
                          .map((submission) => (
                            <Link
                              className="bg-slate-100"
                              href={`${form.id.startsWith("demo") ? "/demo" : ""}/organisations/${
                                router.query.organisationId
                              }/customers/${submission.customerEmail}`}>
                              <div
                                key={submission.id}
                                className="grid grid-cols-5 gap-2 border-t  border-slate-100 p-4 text-sm hover:bg-slate-100/75">
                                <div className="col-span-3">{submission.data[question.name]}</div>
                                <div>
                                  {submission.data.disappointment === "veryDisappointed" ? (
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                      very disappointed
                                    </span>
                                  ) : submission.data.disappointment === "notDisappointed" ? (
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                      not disappointed
                                    </span>
                                  ) : submission.data.disappointment === "somewhatDisappointed" ? (
                                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                                      somewhat disappointed
                                    </span>
                                  ) : null}
                                </div>
                                <div>
                                  <div className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                                    {labelMap[submission.data.role] || <NotProvided />}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function NotProvided() {
  return <span className="text-slate-500">(not provided)</span>;
}
