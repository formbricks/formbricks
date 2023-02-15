"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import PMFThumb2 from "@/images/pmfthumb-2.webp";
import PMFThumb from "@/images/pmfthumb.webp";
import Rahul from "@/images/rahulvohra.jpg";
import { useForm } from "@/lib/forms";
import { getOptionLabelMap, useSubmissions } from "@/lib/submissions";
import { Pie } from "@formbricks/charts";
import { InboxIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";
import { BrainIcon, Button } from "@formbricks/ui";

const limitFields = ["role"];

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
        <section aria-labelledby="filters" className="max-w-8xl mx-auto py-8 pt-10">
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-6 xl:gap-x-16">
            {/* Double down on what they love*/}

            <div className=" md:col-span-4">
              <div className="mb-4 flex items-center rounded-lg bg-white p-4 shadow-sm lg:p-6">
                <Image src={Rahul} alt="Rahul Vohra" className="mr-8 max-h-48 rounded-full" />

                <div>
                  <h2 className="mb-3 text-2xl font-bold text-slate-600">
                    The Superhuman Product-Market Fit Approach
                  </h2>
                  <p className="mb-3 pr-3 text-slate-800">
                    Rahul Vohra, the founder of Superhuman, had a problem. His team spent over a year
                    carefully crafting the perfect email client for high-performers. And yet, they
                    weren&apos;t exactly there yet...
                  </p>

                  <p className="mb-3 pr-3 text-slate-800">
                    He looked for a method to rally his whole team around one goal: Moving closer to
                    Product-Market Fit. Every feature, every commit should make a difference. After extensive
                    research and experimentation, he came up with the{" "}
                    <a
                      href="https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit"
                      target="_blank"
                      rel="noreferrer"
                      className="decoration-brand-dark underline">
                      &apos;Superhuman PMF Engine&apos;
                    </a>
                    . This overview will help you execute the same approach - in a fraction of the time.
                  </p>
                </div>
              </div>
              {submissions.length === 0 ? (
                <EmptyPageFiller
                  alertText="You haven't received any submissions yet."
                  hintText="Embed the PMF survey on your website to start gathering insights."
                  borderStyles="border-4 border-dotted border-red">
                  <InboxIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                </EmptyPageFiller>
              ) : (
                <>
                  <div className="mb-4 rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="my-4 text-xl font-bold text-slate-600">Step 1: Find happiest users</h2>
                    <p className="mb-6 pr-3 text-slate-800">
                      To separate signal from noise, you only look at the feedback from the segment with the
                      highest &apos;very disappointed&apos; score. These are your happiest users. Your
                      happiest users are most likely to be long-term customers:
                    </p>

                    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-2 shadow-sm">
                        <h3 className="text-sm font-medium text-slate-800">All</h3>
                        <h3 className="text-xs font-light text-slate-800">
                          ({submissions.length} submissions)
                        </h3>
                        <Pie submissions={submissions} schema={form.schema} fieldName={"disappointment"} />
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-2 shadow-sm">
                        <h3 className="text-sm font-medium text-slate-800">Most disappointed segment</h3>
                        <h3 className="text-xs font-light text-slate-800">
                          ({filteredSubmissions.length} submissions)
                        </h3>
                        <Pie
                          submissions={filteredSubmissions}
                          schema={form.schema}
                          fieldName={"disappointment"}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-4 rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="my-4 text-xl font-bold text-slate-600">
                      Step 2: Double down on what they love
                    </h2>
                    <p className="mb-6 pr-3 text-slate-800">
                      Your first priority is making your happiest users happier. By deepening the value they
                      get from your product, you can make sure to not be taken over my competitors{" "}
                      <a
                        className="decoration-brand-dark underline"
                        href="https://www.lennysnewsletter.com/p/an-inside-look-at-mixpanels-product#details"
                        target="_blank"
                        rel="noreferrer">
                        (like it happened to Mixpanel).
                      </a>
                    </p>
                    <div className="rounded-lg bg-slate-200 p-4 font-mono shadow-sm">
                      <div className="mb-2 flex">
                        <BrainIcon className="mr-2 h-6 w-6" />
                        <p className="">Main Benefit Summary (AI-powered)</p>
                      </div>
                      <p className="my-4 text-sm">
                        The best is that I can get a quick overview of all my transactions. The best is that I
                        can get a quick overview of all my transactions. The best is that I can get a quick
                        overview of all my transactions.
                      </p>
                      <div className="text-right">
                        <Button variant="primary" className="">
                          Regenerate
                        </Button>
                      </div>
                    </div>

                    <div className="my-4 rounded-lg bg-white">
                      <div className="text-md rounded-t-lg bg-slate-100 p-4 font-bold  text-slate-600">
                        What is the main benefit you receive from our service?
                      </div>
                      <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                        <div className="col-span-3">Response</div>
                        <div>Disappointment Level</div>
                        <div>Role</div>
                      </div>
                      {lovers.length === 0 ? (
                        <div className="p-4">
                          <h3 className="text-center text-sm font-bold text-slate-400">
                            You don’t have any submissions that fit this filter.
                          </h3>
                          <p className="mt-1 text-center text-xs font-light text-slate-400">
                            Change your filters or come back when you have more submissions.
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-auto rounded-b-lg">
                          {lovers.map((submission) => (
                            <Link
                              href={`${form.id.startsWith("demo") ? "/demo" : ""}/organisations/${
                                router.query.organisationId
                              }/customers/${submission.customerEmail}`}>
                              <div className="grid grid-cols-5 gap-2 bg-slate-50 p-4 text-sm hover:bg-slate-200">
                                <div className="col-span-3 text-slate-800">
                                  {submission.data.mainBenefit || <NotProvided />}
                                </div>
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
                      )}
                    </div>
                  </div>

                  <div className="mb-4 rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="my-4 text-xl font-bold text-slate-600">
                      Step 3: Fix what&apos;s holding them back
                    </h2>
                    <p className="mb-6 pr-3 text-slate-800">
                      Your second priority is to increase the amount of people who would be &apos;very
                      disappointed&apos; when they could no longer use your product. This helps you craft a
                      product for a wider audience.
                    </p>
                    <div className="rounded-lg bg-slate-200 p-4 font-mono shadow-sm">
                      <div className="mb-2 flex">
                        <BrainIcon className="mr-2 h-6 w-6" />
                        <p className="">Next Action Steps (AI-powered)</p>
                      </div>
                      <p className="my-4 text-sm">
                        Based on the submissions below, we suggest targeting these three aspects first:
                        <ul className="my-2 ml-5 list-disc">
                          <li>Fix this quick and easy</li>
                          <li>Fix this quick and easy</li>
                          <li>Fix this quick and easy</li>
                        </ul>
                      </p>
                      <div className="text-right">
                        <Button variant="primary" className="">
                          Regenerate
                        </Button>
                      </div>
                    </div>
                    <div className="my-4 rounded-lg bg-white">
                      <div className="text-md rounded-t-lg bg-slate-100 p-4 font-bold  text-slate-600">
                        How can we improve our service for you?
                      </div>
                      <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                        <div className="col-span-3">Response</div>
                        <div>Disappointment Level</div>
                        <div>Role</div>
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
                        <div className="max-h-96 overflow-auto">
                          {improvers.map((submission) => (
                            <Link
                              href={`${form.id.startsWith("demo") ? "/demo" : ""}/organisations/${
                                router.query.organisationId
                              }/customers/${submission.customerEmail}`}>
                              <div className="grid grid-cols-5 gap-2 p-4 text-sm hover:bg-slate-100/75">
                                <div className="col-span-3 text-slate-800">
                                  {submission.data.improvement || <NotProvided />}
                                </div>
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
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="col-span-2 h-fit rounded-lg bg-slate-100 p-4 xl:p-8">
              <Link
                href="https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit"
                target={"_blank"}>
                <div className="mb-4 rounded-md bg-white shadow-sm transition-all duration-100 ease-in-out hover:scale-105">
                  <Image src={PMFThumb} className="w-full rounded-t-md" alt={"PMF Article Thumb 1"} />

                  <div className="p-4">
                    <p className="font-bold text-slate-600">
                      Superhuman built an engine to find Product-Market Fit
                    </p>
                    <p className="text-brand-dark mt-1 text-sm">
                      firstround.com{" "}
                      <span className="bg-brand-dark ml-2 rounded-full px-2 text-white">In-depth Guide</span>
                    </p>
                  </div>
                </div>
              </Link>

              <Link href="https://coda.io/@rahulvohra/superhuman-product-market-fit-engine" target={"_blank"}>
                <div className="mb-4 rounded-md bg-white shadow-sm transition-all duration-100 ease-in-out hover:scale-105">
                  <Image src={PMFThumb2} className="w-full rounded-t-md" alt={"PMF Article Thumb 2"} />
                  <div className="p-4">
                    <p className="font-bold text-slate-600">The Superhuman Product/Market Fit Engine</p>
                    <p className="text-brand-dark text-sm">
                      coda.io<span className="bg-brand-dark ml-2 rounded-full px-2 text-white">Tutorial</span>
                    </p>
                  </div>
                </div>
              </Link>

              <FilterNavigation
                submissions={submissions}
                setFilteredSubmissions={setFilteredSubmissions}
                limitFields={limitFields}
              />
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
