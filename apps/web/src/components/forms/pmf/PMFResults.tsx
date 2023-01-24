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
import { InboxIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";
import PMFTimeline from "./PMFTimeline";
import { Button } from "@formbricks/ui";

const subCategories = [
  { name: "Somewhat disappointed", href: "#" },
  { name: "Very disappointed", href: "#" },
  { name: "Not disappointed", href: "#" },
];

export default function PMFResults() {
  const router = useRouter();
  const { submissions, isLoadingSubmissions, isErrorSubmissions, mutateSubmissions } = useSubmissions(
    router.query.workspaceId?.toString(),
    router.query.formId?.toString()
  );

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
      newSubmissions = submissions.filter((submission) => submission.data.pmfType === currentFilter);
    }
    setFilteredSubmissions(newSubmissions);
  }, [currentFilter, submissions]);

  useEffect(() => {
    if (!isLoadingSubmissions) {
      setFilteredSubmissions(submissions.filter((submission) => !submission.archived));
    }
  }, [isLoadingSubmissions, submissions]);

  const resetFilter = (e) => {
    e.preventDefault();
    setCurrentFilter("all");
  };

  const navigation = useMemo(() => {
    if (!submissions) return [];
    const pmfCounts = {
      nodis: 0,
      vdis: 0,
      sdis: 0,
      archive: 0,
    };
    for (const submission of submissions) {
      if (submission.archived) {
        pmfCounts.archive++;
      } else {
        pmfCounts[submission.data.pmfType]++;
      }
    }
    return [
      {
        id: "veryDisappointed",
        name: "Very disappointed",
        href: "#",
        icon: VeryDisappointedIcon,
        current: false,
        count: pmfCounts.vdis,
        color: "bg-green-400",
      },
      {
        id: "somewhatDisappointed",
        name: "Somewhat disappointed",
        href: "#",
        icon: SomewhatDisappointedIcon,
        current: false,
        count: pmfCounts.sdis,
        color: "bg-yellow-400",
      },
      {
        id: "notDisappointed",
        name: "Not disappointed",
        href: "#",
        icon: NotDisappointedIcon,
        current: false,
        color: "bg-red-400",
        count: pmfCounts.nodis,
      },
      {
        id: "archive",
        name: "Archived",
        href: "#",
        icon: ArchiveIcon,
        current: false,
        count: pmfCounts.archive,
        color: "bg-gray-300",
      },
    ];
  }, [submissions]);

  const completed = useMemo(() => {
    if (!submissions) return [];
    const pmfCounts = {
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
        count: pmfCounts.complete,
        color: "bg-slate-400",
      },
      {
        id: "partial",
        name: "Partials",
        href: "#",
        icon: IdeaIcon,
        current: false,
        count: pmfCounts.partial,
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
              <form className="hidden md:block">
                <h3 className="sr-only">Filter</h3>
                <div className="flex py-2 text-sm font-bold">
                  <h4 className="text-slate-600">Filter</h4>{" "}
                  <a onClick={(e) => resetFilter(e)} className="text-brand-dark ml-3 cursor-pointer">
                    All
                  </a>
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

              <form className="mt-4 hidden md:block">
                <h3 className="sr-only">Completed</h3>
                <div className="flex py-2 text-sm font-bold">
                  <h4 className="text-slate-600">Completed</h4>{" "}
                  <a onClick={(e) => resetFilter(e)} className="text-brand-dark ml-3 cursor-pointer">
                    All
                  </a>
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

              <form className="mt-4 hidden max-w-3xl md:block">
                <h3 className="sr-only">Segments</h3>
                <div className="flex py-2 text-sm font-bold">
                  <h4 className="text-slate-600">Segments</h4>{" "}
                  <a onClick={(e) => resetFilter(e)} className="text-brand-dark ml-3 cursor-pointer">
                    All
                  </a>
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

            <div className="max-w-3xl md:col-span-3">
              {submissions.length === 0 ? (
                <EmptyPageFiller
                  alertText="You haven't received any submissions yet."
                  hintText="Embed the PMF survey on your website to start gathering insights."
                  borderStyles="border-4 border-dotted border-red">
                  <InboxIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                </EmptyPageFiller>
              ) : (
                <PMFTimeline submissions={filteredSubmissions} setSubmissions={setFilteredSubmissions} />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
