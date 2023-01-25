"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useSubmissions } from "@/lib/submissions";
import { BugIcon, ComplimentIcon, FormIcon, IdeaIcon } from "@formbricks/ui";
import { Dialog, Transition } from "@headlessui/react";
import { InboxIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";
import FeedbackTimeline from "./FeedbackTimeline";

const subCategories = [
  { name: "All", href: "#" },
  { name: "Ideas", href: "#" },
  { name: "Love", href: "#" },
  { name: "Bugs", href: "#" },
];

export default function FeedbackResults() {
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
      bug: 0,
      compliment: 0,
      idea: 0,
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
        id: "all",
        name: "All",
        href: "#",
        icon: FormIcon,
        current: true,
        count: submissions.length - feedbackCounts.archive,
        color: "bg-indigo-400",
      },
      {
        id: "bug",
        name: "Bug",
        href: "#",
        icon: BugIcon,
        current: false,
        color: "bg-red-400",
        count: feedbackCounts.bug,
      },
      {
        id: "compliment",
        name: "Love",
        href: "#",
        icon: ComplimentIcon,
        current: false,
        count: feedbackCounts.compliment,
        color: "bg-green-400",
      },
      {
        id: "idea",
        name: "Idea",
        href: "#",
        icon: IdeaIcon,
        current: false,
        count: feedbackCounts.idea,
        color: "bg-yellow-400",
      },
      {
        id: "archive",
        name: "Archive",
        href: "#",
        icon: IdeaIcon,
        current: false,
        count: feedbackCounts.archive,
        color: "bg-gray-300",
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
  return (
    <div>
      {/* Mobile filter dialog */}
      <Transition.Root show={mobileFiltersOpen} as={Fragment}>
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

                {/* Filters */}
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
      </Transition.Root>
      <div>
        <section aria-labelledby="products-heading" className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
            <FilterNavigation submissions={submissions} setFilteredSubmissions={setFilteredSubmissions} />

            {/* Product grid */}
            <div className="lg:col-span-3">
              {submissions.length === 0 ? (
                <EmptyPageFiller
                  alertText="You haven't received any submissions yet."
                  hintText="Embed the feedback widget on your website to start receiving feedback."
                  borderStyles="border-4 border-dotted border-red">
                  <InboxIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                </EmptyPageFiller>
              ) : (
                <FeedbackTimeline submissions={filteredSubmissions} setSubmissions={setFilteredSubmissions} />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
