"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { useSubmissions } from "@/lib/submissions";
import { useTeam } from "@/lib/teams";
import { BugIcon, ComplimentIcon, FormIcon, IdeaIcon } from "@formbricks/ui";
import { Dialog, Disclosure, Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon, FunnelIcon, MinusIcon, PlusIcon } from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";
import FeedbackTimeline from "./FeedbackTimeline";

/* const sortOptions = [
  { name: "Most Popular", href: "#", current: true },
  { name: "Best Rating", href: "#", current: false },
  { name: "Newest", href: "#", current: false },
  { name: "Price: Low to High", href: "#", current: false },
  { name: "Price: High to Low", href: "#", current: false },
]; */
const subCategories = [
  { name: "All", href: "#" },
  { name: "Ideas", href: "#" },
  { name: "Compliments", href: "#" },
  { name: "Bugs", href: "#" },
];
const filters = [
  /* {
    id: "color",
    name: "Color",
    options: [
      { value: "white", label: "White", checked: false },
      { value: "beige", label: "Beige", checked: false },
      { value: "blue", label: "Blue", checked: true },
      { value: "brown", label: "Brown", checked: false },
      { value: "green", label: "Green", checked: false },
      { value: "purple", label: "Purple", checked: false },
    ],
  }, */
];

/* const submissions = [
  {
    id: 1,
    createdAt: "2022-12-19T11:30:02.574Z",
    updatedAt: "2022-12-19T11:30:02.574Z",
    customer: {
      id: "1",
      name: "John Doe",
      email: "doe@example.com",
    },
    data: {
      feedbackType: "compliment",
      message: "I love this app!",
    },
    meta: {
      userAgent: "PostmanRuntime/7.29.2",
      sourceUrl: "https://example.com",
    },
    archived: false,
  },
  {
    id: 1,
    createdAt: "2022-12-19T11:30:02.574Z",
    updatedAt: "2022-12-19T11:30:02.574Z",
    customer: {
      id: "1",
      name: "John Doe",
      email: "doe@example.com",
    },
    data: {
      feedbackType: "bug",
      message: "Could you please solve this problem?",
    },
    meta: {
      userAgent: "PostmanRuntime/7.29.2",
      sourceUrl: "https://example.com",
    },
    archived: false,
  },
]; */

export default function FeedbackResults() {
  const router = useRouter();
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.teamId?.toString()
  );
  const { team, isLoadingTeam, isErrorTeam } = useTeam(router.query.teamId?.toString());
  const { submissions, isLoadingSubmissions, isErrorSubmissions, mutateSubmissions } = useSubmissions(
    router.query.teamId?.toString(),
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
  }, [isLoadingSubmissions]);

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
        name: "Compliment",
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

  if (isLoadingForm || isLoadingTeam || isLoadingSubmissions) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForm || isErrorTeam || isErrorSubmissions) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="">
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

                    {filters.map((section) => (
                      <Disclosure as="div" key={section.id} className="border-t border-gray-200 px-4 py-6">
                        {({ open }) => (
                          <>
                            <h3 className="-mx-2 -my-3 flow-root">
                              <Disclosure.Button className="flex w-full items-center justify-between bg-white px-2 py-3 text-gray-400 hover:text-gray-500">
                                <span className="font-medium text-gray-900">{section.name}</span>
                                <span className="ml-6 flex items-center">
                                  {open ? (
                                    <MinusIcon className="h-5 w-5" aria-hidden="true" />
                                  ) : (
                                    <PlusIcon className="h-5 w-5" aria-hidden="true" />
                                  )}
                                </span>
                              </Disclosure.Button>
                            </h3>
                            <Disclosure.Panel className="pt-6">
                              <div className="space-y-6">
                                {section.options.map((option, optionIdx) => (
                                  <div key={option.value} className="flex items-center">
                                    <input
                                      id={`filter-mobile-${section.id}-${optionIdx}`}
                                      name={`${section.id}[]`}
                                      defaultValue={option.value}
                                      type="checkbox"
                                      defaultChecked={option.checked}
                                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label
                                      htmlFor={`filter-mobile-${section.id}-${optionIdx}`}
                                      className="ml-3 min-w-0 flex-1 text-gray-500">
                                      {option.label}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </Disclosure.Panel>
                          </>
                        )}
                      </Disclosure>
                    ))}
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        <main className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between border-b border-gray-200 pt-8 pb-6">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Feedback</h1>

            {/* <div className="flex items-center">
              <Menu as="div" className="relative inline-block text-left">
                <div>
                  <Menu.Button className="group inline-flex justify-center text-sm font-medium text-gray-700 hover:text-gray-900">
                    Sort
                    <ChevronDownIcon
                      className="-mr-1 ml-1 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                      aria-hidden="true"
                    />
                  </Menu.Button>
                </div>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95">
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                      {sortOptions.map((option) => (
                        <Menu.Item key={option.name}>
                          {({ active }) => (
                            <a
                              href={option.href}
                              className={clsx(
                                option.current ? "font-medium text-gray-900" : "text-gray-500",
                                active ? "bg-gray-100" : "",
                                "block px-4 py-2 text-sm"
                              )}>
                              {option.name}
                            </a>
                          )}
                        </Menu.Item>
                      ))}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>

              <button
                type="button"
                className="-m-2 ml-4 p-2 text-gray-400 hover:text-gray-500 sm:ml-6 lg:hidden"
                onClick={() => setMobileFiltersOpen(true)}>
                <span className="sr-only">Filters</span>
                <FunnelIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div> */}
          </div>

          <section aria-labelledby="products-heading" className="pt-6 pb-24">
            <h2 id="products-heading" className="sr-only">
              Products
            </h2>

            <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
              {/* Filters */}
              <form className="hidden lg:block">
                <h3 className="sr-only">Categories</h3>
                {navigation.map((item) => (
                  <button
                    type="button"
                    key={item.name}
                    onClick={() => setCurrentFilter(item.id)}
                    className={clsx(
                      item.id === currentFilter
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium"
                    )}
                    aria-current={item.id === currentFilter ? "page" : undefined}>
                    <div className={clsx(item.color, "-ml-1 mr-3 h-2 w-2 flex-shrink-0 rounded-full")} />
                    <span className="truncate">{item.name}</span>
                    {item.count ? (
                      <span
                        className={clsx(
                          item.id === currentFilter ? "bg-white" : "bg-gray-100 group-hover:bg-gray-200",
                          "ml-auto inline-block rounded-full py-0.5 px-3 text-xs"
                        )}>
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                ))}

                {filters.map((section) => (
                  <Disclosure as="div" key={section.id} className="border-b border-gray-200 py-6">
                    {({ open }) => (
                      <>
                        <h3 className="-my-3 flow-root">
                          <Disclosure.Button className="flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
                            <span className="font-medium text-gray-900">{section.name}</span>
                            <span className="ml-6 flex items-center">
                              {open ? (
                                <MinusIcon className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <PlusIcon className="h-5 w-5" aria-hidden="true" />
                              )}
                            </span>
                          </Disclosure.Button>
                        </h3>
                        <Disclosure.Panel className="pt-6">
                          <div className="space-y-4">
                            {section.options.map((option, optionIdx) => (
                              <div key={option.value} className="flex items-center">
                                <input
                                  id={`filter-${section.id}-${optionIdx}`}
                                  name={`${section.id}[]`}
                                  defaultValue={option.value}
                                  type="checkbox"
                                  defaultChecked={option.checked}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label
                                  htmlFor={`filter-${section.id}-${optionIdx}`}
                                  className="ml-3 text-sm text-gray-600">
                                  {option.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>
                ))}
              </form>

              {/* Product grid */}
              <div className="lg:col-span-3">
                <FeedbackTimeline submissions={filteredSubmissions} setSubmissions={setFilteredSubmissions} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
