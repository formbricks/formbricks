"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useSubmissions } from "@/lib/submissions";
import {
  ArchiveIcon,
  ComplimentIcon,
  IdeaIcon,
  VeryDisappointedIcon,
  SomewhatDisappointedIcon,
  NotDisappointedIcon,
} from "@formbricks/ui";
import Image from "next/image";
import PMFThumb from "@/images/pmfthumb.webp";
import PMFThumb2 from "@/images/pmfthumb-2.webp";
import Link from "next/link";
import { InboxIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";
import FeedbackTimeline from "./PMFTimeline";
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

  const completed = [
    {
      segment: "Founder",
    },
    {
      segment: "Entrepreneur",
    },
    {
      segment: "Product Manager",
    },
    {
      segment: "Engineer",
    },
  ];

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
      feeling: "very disapp.",
      segment: "Entrepreneur",
    },
    {
      response:
        "C think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "very disapp.",
      segment: "Product Manager",
    },
  ];

  const q2responses = [
    {
      response:
        "A think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "somewhat disapp.",
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
      feeling: "somewhat disapp.",
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
            <div>
              {/* Segments */}

              <form className="mb-4 hidden lg:block">
                <h3 className="sr-only">Segment</h3>
                <div className="flex py-2 text-sm font-bold">
                  <h4 className="text-slate-600">Segment</h4>
                </div>
                {completed.map((item) => (
                  <button
                    type="button"
                    key={item.segment}
                    className={clsx(
                      item.segment === currentFilter
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                      "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium"
                    )}>
                    <div className="-ml-1 mr-3 h-2 w-2 flex-shrink-0 rounded-full" />
                    <span className="truncate">{item.segment}</span>
                  </button>
                ))}
              </form>
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

            <div className="max-w-3xl lg:col-span-3">
              <div className="flex w-full space-x-3">
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  overall results
                </div>
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  max. very d. segment
                </div>
              </div>
              <h2 className="mt-10 mb-4 text-2xl font-bold text-slate-500">Double down on what they love</h2>
              <div className="my-4 rounded-lg bg-white">
                <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                  What is the main benefit you receive from our service?
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
              <h2 className="mt-10 mb-4 text-2xl font-bold text-slate-500">Fix what’s holding them back</h2>
              <div className="my-4 rounded-lg bg-white">
                <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                  How can we improve our service for you?
                </div>
                <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                  <div className="col-span-3">Response</div>
                  <div>Feeling</div>
                  <div>Segment</div>
                </div>
                {q2responses.map((r) => (
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
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
