"use client";

import AnalyticsCard from "@/components/AnalyticsCard";
import SubmissionDisplay from "@/components/forms/submissions/SubmissionDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCustomer } from "@/lib/customers";
import { useWorkspace } from "@/lib/workspaces";
import { convertDateTimeString, onlyUnique } from "@/lib/utils";
import { BackIcon, BugIcon, ComplimentIcon, IdeaIcon } from "@formbricks/ui";
import { Dialog, Transition } from "@headlessui/react";
import { InboxIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";
import EmptyPageFiller from "../EmptyPageFiller";

export default function SingleCustomerPage() {
  const router = useRouter();
  const { workspace, isLoadingWorkspace, isErrorWorkspace } = useWorkspace(
    router.query.workspaceId?.toString()
  );
  const { customer, isLoadingCustomer, isErrorCustomer } = useCustomer(
    router.query.workspaceId?.toString(),
    router.query.customerId?.toString()
  );

  const formsParticipated = useMemo(() => {
    if (customer && "submissions" in customer) {
      return customer.submissions.map((s) => s.formId).filter(onlyUnique).length;
    }
  }, [customer]);

  if (isLoadingWorkspace || isLoadingCustomer) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorWorkspace || isErrorCustomer) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          className="inline-flex pt-5 text-sm text-gray-500"
          href={`/workspaces/${router.query.workspaceId}/customers/`}>
          <BackIcon className="mr-2 h-5 w-5" />
          Back to customers overview
        </Link>
        <div className="flex items-baseline justify-between border-b border-gray-200 pt-4 pb-6">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">{customer.email}</h1>
        </div>

        <section className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-700">Properties</h2>
              {"name" in customer.data && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{customer.data.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.email}</dd>
              </div>
              {Object.entries(customer.data).map(
                ([key, value]) =>
                  !["name", "email"].includes(key) && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{key}</dt>
                      <dd className="mt-1 text-sm text-gray-900">{value.toString()}</dd>
                    </div>
                  )
              )}
              <hr className="text-gray-600" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Number of forms participated</dt>
                <dd className="mt-1 text-sm text-gray-900">{formsParticipated}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Number of form submissions</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.submissions.length}</dd>
              </div>
            </div>

            {/* Product grid */}
            <div className="lg:col-span-3">
              {customer.submissions.length === 0 ? (
                <EmptyPageFiller
                  alertText="You haven't received any submissions yet."
                  hintText="Embed the feedback widget on your website to start receiving feedback."
                  borderStyles="border-4 border-dotted border-red">
                  <InboxIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                </EmptyPageFiller>
              ) : (
                <>
                  {customer.submissions.map((submission, submissionIdx) => (
                    <li key={submission.id} className="list-none">
                      <div className="relative pb-8">
                        {submissionIdx !== customer.submissions.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span
                              className={clsx(
                                "bg-white",
                                "flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-gray-50"
                              )}>
                              {submission.data.feedbackType === "compliment" ? (
                                <ComplimentIcon className="h-6 w-6 text-white" aria-hidden="true" />
                              ) : submission.data.feedbackType === "bug" ? (
                                <BugIcon className="h-6 w-6 text-white" aria-hidden="true" />
                              ) : (
                                <IdeaIcon className="h-6 w-6 text-white" aria-hidden="true" />
                              )}
                            </span>
                          </div>
                          <div className="w-full overflow-hidden rounded-lg bg-white shadow">
                            <div className="px-4 py-5 sm:p-6">
                              <div className="flex w-full justify-between">
                                {submission.data.feedbackType === "compliment" ? (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                    Love
                                  </span>
                                ) : submission.data.feedbackType === "bug" ? (
                                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                    Bug
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                                    Idea
                                  </span>
                                )}

                                <div className="text-sm text-gray-400">
                                  <time dateTime={convertDateTimeString(submission.createdAt)}>
                                    {convertDateTimeString(submission.createdAt)}
                                  </time>
                                </div>
                              </div>
                              <div className="mt-3">
                                <p className="whitespace-pre-wrap text-sm text-gray-500">
                                  {submission.data.message}{" "}
                                </p>
                              </div>
                            </div>
                            <div className=" bg-gray-50 p-4 sm:p-6">
                              <div className="flex w-full justify-between gap-4">
                                <div>
                                  <p className="text-sm font-thin text-gray-500">Device</p>
                                  <p className="text-sm text-gray-500">{submission.meta.userAgent}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-thin text-gray-500">Page</p>
                                  <p className="text-sm text-gray-500">{submission.data.pageUrl}</p>
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
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
