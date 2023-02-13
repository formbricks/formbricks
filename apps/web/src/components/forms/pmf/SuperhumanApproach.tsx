"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import PMFThumb2 from "@/images/pmfthumb-2.webp";
import PMFThumb from "@/images/pmfthumb.webp";
import { useForm } from "@/lib/forms";
import { getOptionLabelMap, useSubmissions } from "@/lib/submissions";
import { Pie } from "@formbricks/charts";
import { NotDisappointedIcon, SomewhatDisappointedIcon, VeryDisappointedIcon } from "@formbricks/ui";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";

const limitFields = ["userSegment"];

export default function SegmentResults() {
  const router = useRouter();
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);
  const { submissions, isLoadingSubmissions, isErrorSubmissions } = useSubmissions(
    router.query.organisationId?.toString(),
    router.query.formId?.toString()
  );
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.organisationId?.toString()
  );
  const lovers = useMemo(
    () =>
      filteredSubmissions.filter((s) => s.data.disappointment === "veryDisappointed" && s.data.mainBenefit),
    [filteredSubmissions]
  );

  const improvers = useMemo(
    () =>
      filteredSubmissions.filter(
        (s) => s.data.disappointment === "somewhatDisappointed" && s.data.improvement
      ),
    [filteredSubmissions]
  );

  const labelMap = useMemo(() => {
    if (form) {
      return getOptionLabelMap(form.schema);
    }
  }, [form]);

  if (isLoadingSubmissions || isLoadingForm) return <LoadingSpinner />;

  if (isErrorSubmissions || isErrorForm)
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;

  return (
    <div>
      <div>
        <section aria-labelledby="filters" className="max-w-8xl mx-auto py-8">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-4">
            <div>
              {/* Segments */}

              <FilterNavigation
                submissions={submissions}
                setFilteredSubmissions={setFilteredSubmissions}
                limitFields={limitFields}
              />
              <div className="mb-2 flex py-2 text-sm font-bold">
                <h4 className="text-slate-600">Tutorials</h4>
              </div>
              <Link
                href="https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit"
                target={"_blank"}>
                <div className="mb-4 rounded-md bg-white shadow-sm transition-all duration-100 ease-in-out hover:scale-105">
                  <Image src={PMFThumb} className="rounded-t-md" alt={"PMF Article Thumb 1"} />

                  <div className="p-4">
                    <p className="font-bold text-slate-600">
                      Superhuman built an engine to find Product-Market Fit
                    </p>
                    <p className="text-brand-dark text-sm">firstround.com</p>
                  </div>
                </div>
              </Link>

              <Link href="https://coda.io/@rahulvohra/superhuman-product-market-fit-engine" target={"_blank"}>
                <div className="mb-4 rounded-md bg-white shadow-sm transition-all duration-100 ease-in-out hover:scale-105">
                  <Image src={PMFThumb2} className="rounded-t-md" alt={"PMF Article Thumb 2"} />
                  <div className="p-4">
                    <p className="font-bold text-slate-600">The Superhuman Product/Market Fit Engine</p>
                    <p className="text-brand-dark text-sm">coda.io</p>
                  </div>
                </div>
              </Link>
            </div>

            {/* Double down on what they love*/}

            <div className=" lg:col-span-3">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="flex flex-col items-center justify-center rounded-lg bg-white p-2">
                  <h3 className="text-sm font-medium text-slate-800">Overall</h3>
                  <h3 className="text-xs font-light text-slate-800">({submissions.length} submissions)</h3>
                  <Pie submissions={submissions} schema={form.schema} fieldName={"disappointment"} />
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-white p-2">
                  <h3 className="text-sm font-medium text-slate-800">Selected Segment</h3>
                  <h3 className="text-xs font-light text-slate-800">
                    ({filteredSubmissions.length} submissions)
                  </h3>
                  <Pie submissions={filteredSubmissions} schema={form.schema} fieldName={"disappointment"} />
                </div>
              </div>
              <h2 className="mt-10 mb-4 text-2xl font-bold text-slate-500">Double down on what they love</h2>
              <div className="rounded-md bg-teal-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                      How it works
                    </span>
                  </div>
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-teal-700">
                      To protect the PMF score from eroding among already very satisfied users, you deepen the
                      value they experience. To do so, you build what they request in the following answers.
                    </p>
                  </div>
                </div>
              </div>
              <div className="my-4 rounded-lg bg-white">
                <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-700">
                  What is the main benefit you receive from our service?
                </div>
                <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                  <div className="col-span-3">Response</div>
                  <div>Disappointment</div>
                  <div>Segment</div>
                </div>
                {lovers.length === 0 ? (
                  <div className="p-4">
                    <h3 className="text-center text-sm font-bold text-slate-400">
                      You don’t have any submissions that fit this filter
                    </h3>
                    <p className="mt-1 text-center text-xs font-light text-slate-400">
                      Change your filters or come back when you have more submissions.
                    </p>
                  </div>
                ) : (
                  <>
                    {lovers.map((submission) => (
                      <div className="grid grid-cols-5 gap-2 px-4 pt-2 pb-4 text-sm">
                        <div className="col-span-3 text-slate-800">
                          {submission.data.mainBenefit || <NotProvided />}
                        </div>
                        <div>
                          {submission.data.disappointment === "veryDisappointed" ? (
                            <VeryDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : submission.data.disappointment === "notDisappointed" ? (
                            <NotDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : submission.data.disappointment === "somewhatDisappointed" ? (
                            <SomewhatDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : null}
                        </div>
                        <div>
                          <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                            {labelMap[submission.data.userSegment] || <NotProvided />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <h2 className="mt-10 mb-4 text-2xl font-bold text-slate-500">Fix what’s holding them back</h2>
              <div className="rounded-md bg-teal-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                      How it works
                    </span>
                  </div>
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-teal-700">
                      To make more users “very disappointed” when your product were to go away, you build
                      what’s holding the “somewhat disappointed” users back.
                    </p>
                  </div>
                </div>
              </div>
              <div className="my-4 rounded-lg bg-white">
                <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-700">
                  How can we improve our service for you?
                </div>
                <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                  <div className="col-span-3">Response</div>
                  <div>Disappointment</div>
                  <div>Segment</div>
                </div>
                {improvers.length === 0 ? (
                  <div className="p-4">
                    <h3 className="text-center text-sm font-bold text-slate-400">
                      You don’t have any submissions that fit this filter
                    </h3>
                    <p className="mt-1 text-center text-xs font-light text-slate-400">
                      Change your filters or come back when you have more submissions.
                    </p>
                  </div>
                ) : (
                  <>
                    {improvers.map((submission) => (
                      <div className="grid grid-cols-5 gap-2 px-4 pt-2 pb-4 text-sm">
                        <div className="col-span-3 text-slate-800">
                          {submission.data.improvement || <NotProvided />}
                        </div>
                        <div>
                          {submission.data.disappointment === "veryDisappointed" ? (
                            <VeryDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : submission.data.disappointment === "notDisappointed" ? (
                            <NotDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : submission.data.disappointment === "somewhatDisappointed" ? (
                            <SomewhatDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : null}
                        </div>
                        <div>
                          <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                            {labelMap[submission.data.userSegment] || <NotProvided />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
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
