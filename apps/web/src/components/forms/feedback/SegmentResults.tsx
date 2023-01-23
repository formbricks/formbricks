"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useSubmissions } from "@/lib/submissions";
import {
  ArchiveIcon,
  ComplimentIcon,
  IdeaIcon,
  VeryDisappointed,
  SomewhatDisappointed,
  NotDisappointed,
} from "@formbricks/ui";
import { InboxIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";
import FeedbackTimeline from "./FeedbackTimeline";
import { Button } from "@formbricks/ui";
import sq from "date-fns/esm/locale/sq/index.js";

const subCategories = [
  { name: "Somewhat disappointed", href: "#" },
  { name: "Very disappointed", href: "#" },
  { name: "Not disappointed", href: "#" },
];

export default function SegmentResults() {
  const router = useRouter();
  const { submissions, isLoadingSubmissions, isErrorSubmissions, mutateSubmissions } = useSubmissions(
    router.query.workspaceId?.toString(),
    router.query.formId?.toString()
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);

  useEffect(() => {
    if (!submissions) return;
    let newSubmissions = [];
    if (currentFilter === "all") {
      newSubmissions = submissions.filter((submission) => !submission.archived);
    } else if (currentFilter === "archive") {
      newSubmissions = submissions.filter((submission) => submission.archived);
    } else {
      newSubmissions = submissions.filter((submission) => submission.data.feedbackType === currentFilter);
    }
    setFilteredSubmissions(newSubmissions);
  }, [currentFilter, submissions]);

  useEffect(() => {
    if (!isLoadingSubmissions) {
      setFilteredSubmissions(submissions.filter((submission) => !submission.archived));
    }
  }, [isLoadingSubmissions, submissions]);

  const navigation = useMemo(() => {
    if (!submissions) return [];
    const feedbackCounts = {
      nodis: 0,
      vdis: 0,
      sdis: 0,
      archive: 0,
    };
    for (const submission of submissions) {
      if (submission.archived) {
        feedbackCounts.archive++;
      } else {
        feedbackCounts[submission.data.feedbackType]++;
      }
    }
    return [
      {
        id: "vdis",
        name: "Very disappointed",
        href: "#",
        icon: VeryDisappointed,
        current: false,
        count: feedbackCounts.vdis,
        color: "bg-green-400",
      },
      {
        id: "sdis",
        name: "Somewhat disappointed",
        href: "#",
        icon: SomewhatDisappointed,
        current: false,
        count: feedbackCounts.sdis,
        color: "bg-yellow-400",
      },
      {
        id: "nodis",
        name: "Not disappointed",
        href: "#",
        icon: NotDisappointed,
        current: false,
        color: "bg-red-400",
        count: feedbackCounts.nodis,
      },
      {
        id: "archive",
        name: "Archived",
        href: "#",
        icon: ArchiveIcon,
        current: false,
        count: feedbackCounts.archive,
        color: "bg-gray-300",
      },
    ];
  }, [submissions]);

  const completed = useMemo(() => {
    if (!submissions) return [];
    const feedbackCounts = {
      complete: 0,
      partial: 0,
    };

    return [
      {
        id: "complete",
        name: "Completed",
        href: "#",
        icon: ComplimentIcon,
        current: false,
        count: feedbackCounts.complete,
        color: "bg-slate-400",
      },
      {
        id: "partial",
        name: "Partials",
        href: "#",
        icon: IdeaIcon,
        current: false,
        count: feedbackCounts.partial,
        color: "bg-slate-400",
      },
    ];
  }, [submissions]);

  if (isLoadingSubmissions) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorSubmissions) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  const submissionz = [
    {
      question: "What is the main benefit you receive from our service?",
    },
    {
      question: "How can we improve our service for you?",
    },
    {
      question: "What type of people would benefit most from using our service?",
    },
  ];

  const q1responses = [
    {
      response:
        "A think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "very disapp.",
      segment: "Founder",
    },
    {
      response:
        "B think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "somewhat disapp.",
      segment: "Entrepreneur",
    },
    {
      response:
        "C think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "not disapp.",
      segment: "Product Manager",
    },
  ];

  return (
    <div>
      {/* Mobile filter dialog */}
      {/* <Transition.Root show={mobileFiltersOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={setMobileFiltersOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 z-40 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full">
              <Dialog.Panel className="relative ml-auto flex h-full w-full max-w-xs flex-col overflow-y-auto bg-white py-4 pb-12 shadow-xl">
                <div className="flex items-center justify-between px-4">
                  <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                  <button
                    type="button"
                    className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md bg-white p-2 text-gray-400"
                    onClick={() => setMobileFiltersOpen(false)}>
                    <span className="sr-only">Close menu</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Filters 
                <form className="mt-4 border-t border-gray-200">
                  <h3 className="sr-only">Categories</h3>
                  <ul role="list" className="px-2 py-3 font-medium text-gray-900">
                    {subCategories.map((category) => (
                      <li key={category.name}>
                        <a href={category.href} className="block px-2 py-3">
                          {category.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                  \
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root> */}
      <div>
        <section aria-labelledby="filters" className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-4">
            {/* Filters */}

            <div>
              <form className="hidden lg:block">
                <h3 className="sr-only">Filter</h3>
                <div className="flex py-2 text-sm font-bold">
                  <h4 className="text-slate-600">Filter</h4>{" "}
                  <a className="text-brand-dark ml-3 cursor-pointer">Clear</a>
                </div>
                {navigation.map((item) => (
                  <button
                    type="button"
                    key={item.name}
                    onClick={() => setCurrentFilter(item.id)}
                    className={clsx(
                      item.id === currentFilter
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                      "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium"
                    )}
                    aria-current={item.id === currentFilter ? "page" : undefined}>
                    <div className={clsx(item.color, "-ml-1 mr-3 h-2 w-2 flex-shrink-0 rounded-full")} />
                    <span className="truncate">{item.name}</span>
                    {item.count ? (
                      <span
                        className={clsx(
                          item.id === currentFilter ? "bg-white" : "bg-gray-100 group-hover:bg-white",
                          "ml-auto inline-block rounded-full py-0.5 px-3 text-xs"
                        )}>
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </form>

              {/* Partials vs. Completed */}

              <form className="mt-4 hidden lg:block">
                <h3 className="sr-only">Completed</h3>
                <div className="flex py-2 text-sm font-bold">
                  <h4 className="text-slate-600">Completed</h4>{" "}
                  <a className="text-brand-dark ml-3 cursor-pointer">Clear</a>
                </div>
                {completed.map((item) => (
                  <button
                    type="button"
                    key={item.name}
                    onClick={() => setCurrentFilter(item.id)}
                    className={clsx(
                      item.id === currentFilter
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                      "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium"
                    )}
                    aria-current={item.id === currentFilter ? "page" : undefined}>
                    <div className={clsx(item.color, "-ml-1 mr-3 h-2 w-2 flex-shrink-0 rounded-full")} />
                    <span className="truncate">{item.name}</span>
                    {item.count ? (
                      <span
                        className={clsx(
                          item.id === currentFilter ? "bg-white" : "bg-gray-100 group-hover:bg-white",
                          "ml-auto inline-block rounded-full py-0.5 px-3 text-xs"
                        )}>
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </form>

              {/* Segments */}

              <form className="mt-4 hidden lg:block">
                <h3 className="sr-only">Segments</h3>
                <div className="flex py-2 text-sm font-bold">
                  <h4 className="text-slate-600">Segments</h4>{" "}
                  <a className="text-brand-dark ml-3 cursor-pointer">Clear</a>
                </div>
                {completed.map((item) => (
                  <button
                    type="button"
                    key={item.name}
                    onClick={() => setCurrentFilter(item.id)}
                    className={clsx(
                      item.id === currentFilter
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                      "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium"
                    )}
                    aria-current={item.id === currentFilter ? "page" : undefined}>
                    <div className={clsx(item.color, "-ml-1 mr-3 h-2 w-2 flex-shrink-0 rounded-full")} />
                    <span className="truncate">{item.name}</span>
                    {item.count ? (
                      <span
                        className={clsx(
                          item.id === currentFilter ? "bg-white" : "bg-gray-100 group-hover:bg-white",
                          "ml-auto inline-block rounded-full py-0.5 px-3 text-xs"
                        )}>
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </form>
            </div>

            {/* Submission grid */}

            <div className="max-w-3xl lg:col-span-3">
              <div className="flex w-full space-x-3">
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  overall results
                </div>
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  segment results
                </div>
              </div>
              {submissionz.map((s) => (
                <div key={s.question} className="my-4 rounded-lg bg-white">
                  <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                    {" "}
                    {s.question}{" "}
                  </div>
                  <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                    <div className="col-span-3">Response</div>
                    <div>Feeling</div>
                    <div>Segment</div>
                  </div>
                  {q1responses.map((r) => (
                    <div className="grid grid-cols-5 gap-2 px-4 pt-2 pb-4">
                      <div className="col-span-3">{r.response}</div>
                      <div>
                        <div
                          className={clsx(
                            // base styles independent what type of button it is
                            "inline-grid rounded-full px-2 text-xs",
                            // different styles depending on size
                            r.feeling === "very disapp." && "bg-green-100 text-green-700 ",
                            r.feeling === "somewhat disapp." && "bg-orange-100 text-orange-500 ",
                            r.feeling === "not disapp." && "bg-red-100 text-red-500"
                          )}>
                          {r.feeling}
                        </div>
                      </div>
                      <div>
                        <div className="inline-grid rounded-full bg-slate-100 px-2 text-xs text-slate-600">
                          {r.segment}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
