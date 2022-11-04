import { Popover, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import {
  Bars3Icon,
  BoltIcon,
  ClipboardDocumentListIcon,
  CodeBracketSquareIcon,
  CpuChipIcon,
  CursorArrowRaysIcon,
  CursorArrowRippleIcon,
  DocumentChartBarIcon,
  EnvelopeIcon,
  SquaresPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment } from "react";
import Button from "./Button";
import { Logo } from "./Logo";
import { ThemeSelector } from "./ThemeSelector";

const creation = [
  {
    name: "React Library",
    description: "Build forms with React.js",
    href: "/react-form-builder",
    icon: CodeBracketSquareIcon,
    status: true,
  },
  {
    name: "No Code Builder",
    description: "Notion-like visual builder",
    href: "#",
    icon: CursorArrowRaysIcon,
    status: false,
  },
  {
    name: "Templates",
    description: "CSAT, PMF survey, etc.",
    href: "#",
    icon: ClipboardDocumentListIcon,
    status: false,
  },
];

const pipes = [
  {
    name: "Core API",
    description: "The OS form engine",
    href: "/core-api",
    icon: CpuChipIcon,
    status: true,
  },
  {
    name: "Webhooks",
    description: "Send JSON anywhere",
    href: "/webhooks",
    icon: BoltIcon,
    status: true,
  },
  {
    name: "Email",
    description: "Send data and notifications",
    href: "/email",
    icon: EnvelopeIcon,
    status: true,
  },
  {
    name: "Integrations",
    description: "Connect with 100+ apps",
    href: "/integrations",
    icon: SquaresPlusIcon,
    status: false,
  },
];

const insights = [
  {
    name: "Form HQ",
    description: "Manage submissions easily",
    href: "/form-hq",
    icon: CursorArrowRippleIcon,
    cat: "insights",
    status: true,
  },
  {
    name: "Reports",
    description: "Based on Templates",
    href: "#",
    icon: DocumentChartBarIcon,
    cat: "insights",
    status: false,
  },
];

export default function Header() {
  const router = useRouter();
  return (
    <Popover className="relative">
      <div className="flex items-center justify-between px-4 py-6 sm:px-6 md:justify-start md:space-x-10">
        <div className="flex justify-start lg:w-0 lg:flex-1">
          <Link href="/">
            <span className="sr-only">Formbricks</span>
            <Logo className="h-8 w-auto sm:h-10" />
          </Link>
        </div>
        <div className="-my-2 -mr-2 md:hidden">
          <Popover.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500">
            <span className="sr-only">Open menu</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </Popover.Button>
        </div>
        <Popover.Group as="nav" className="hidden space-x-10 md:flex">
          <Popover className="relative">
            {({ open }) => (
              <>
                <Popover.Button
                  className={clsx(
                    open
                      ? "text-gray-300 "
                      : "text-gray-500  hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50",
                    "group inline-flex items-center rounded-md text-base font-medium hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:hover:text-gray-50"
                  )}>
                  <span>Bricks</span>
                  <ChevronDownIcon
                    className={clsx(
                      open ? "text-gray-600" : "text-gray-400",
                      "ml-2 h-5 w-5 group-hover:text-gray-500"
                    )}
                    aria-hidden="true"
                  />
                </Popover.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1">
                  <Popover.Panel className="absolute z-10 mt-3 -ml-4 w-screen max-w-lg transform lg:left-1/2 lg:ml-0 lg:max-w-4xl lg:-translate-x-1/2">
                    <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="relative grid gap-6 bg-white px-5 py-6 sm:gap-6 sm:p-8 lg:grid-cols-3">
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-blue-400">Form Creation</h4>
                          {creation.map((brick) => (
                            <Link
                              key={brick.name}
                              href={brick.href}
                              className={clsx(
                                brick.status ? "cursor-pointer hover:bg-gray-50" : "cursor-default",
                                "-m-3 flex items-start rounded-lg p-3 py-4"
                              )}>
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-teal-500 sm:h-12 sm:w-12">
                                <brick.icon className="h-6 w-6" aria-hidden="true" />
                              </div>
                              <div className="ml-4">
                                <p
                                  className={clsx(
                                    brick.status ? "text-gray-900" : "text-gray-400",
                                    "text-lg font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="text-sm text-gray-400">{brick.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-blue-400">Data Pipelines</h4>
                          {pipes.map((brick) => (
                            <Link
                              key={brick.name}
                              href={brick.href}
                              className={clsx(
                                brick.status ? "cursor-pointer hover:bg-gray-50" : "cursor-default",
                                "-m-3 flex items-start rounded-lg p-3 py-4"
                              )}>
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-teal-500 sm:h-12 sm:w-12">
                                <brick.icon className="h-6 w-6" aria-hidden="true" />
                              </div>
                              <div className="ml-4">
                                <p
                                  className={clsx(
                                    brick.status ? "text-gray-900" : "text-gray-400",
                                    "text-lg font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="text-sm text-gray-400">{brick.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-blue-400">Data Insights</h4>
                          {insights.map((brick) => (
                            <Link
                              key={brick.name}
                              href={brick.href}
                              className={clsx(
                                brick.status ? "cursor-pointer hover:bg-gray-50" : "cursor-default",
                                "-m-3 flex items-start rounded-lg p-3 py-4"
                              )}>
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-teal-500 sm:h-12 sm:w-12">
                                <brick.icon className="h-6 w-6" aria-hidden="true" />
                              </div>
                              <div className="ml-4">
                                <p
                                  className={clsx(
                                    brick.status ? "text-gray-900" : "text-gray-400",
                                    "text-lg font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="text-sm text-gray-400">{brick.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Popover.Panel>
                </Transition>
              </>
            )}
          </Popover>

          <Link
            href="/community"
            className="text-base font-medium text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50">
            Community
          </Link>
          <Link
            href="/blog"
            className="text-base font-medium text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50">
            Blog
          </Link>
          <Link
            href="/docs"
            className="text-base font-medium text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50">
            Docs
          </Link>
        </Popover.Group>
        <div className="hidden items-center justify-end md:flex md:flex-1 lg:w-0">
          <ThemeSelector className="relative z-10 mr-5" />
          <Button
            variant="secondary"
            EndIcon={GitHubIcon}
            endIconClassName="fill-blue-900 dark:fill-blue-50"
            onClick={() => router.push("https://github.com/formbricks/formbricks")}>
            View on Github
          </Button>
          <Button variant="highlight" className="ml-2" onClick={() => router.push("/get-started")}>
            Get started
          </Button>
        </div>
      </div>

      <Transition
        as={Fragment}
        enter="duration-200 ease-out"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="duration-100 ease-in"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95">
        <Popover.Panel
          focus
          className="absolute inset-x-0 top-0 z-20 origin-top-right transform p-2 transition md:hidden">
          <div className="divide-y-2 divide-gray-50 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="px-5 pt-5 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <Logo className="h-8 w-auto" />
                </div>
                <div className="-mr-2">
                  <Popover.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500">
                    <span className="sr-only">Close menu</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </Popover.Button>
                </div>
              </div>

              <nav className="relative bg-white px-5 py-6">
                <div>
                  <h4 className="mb-3 text-sm text-gray-500">Form Creation</h4>
                  {creation.map((brick) => (
                    <Link
                      key={brick.name}
                      href={brick.href}
                      className={clsx(
                        brick.status ? "cursor-pointer hover:bg-gray-50" : "cursor-default",
                        "-m-3 flex items-start rounded-lg p-3 py-3"
                      )}>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-teal-500 sm:h-12 sm:w-12">
                        <brick.icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="ml-4">
                        <p
                          className={clsx(
                            brick.status ? "text-gray-900" : "text-gray-400",
                            "text-lg font-semibold"
                          )}>
                          {brick.name}
                        </p>
                        <p className="text-sm text-gray-400">{brick.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div>
                  <h4 className="mt-8 mb-3 text-sm text-gray-500">Data Pipelines</h4>
                  {pipes.map((brick) => (
                    <Link
                      key={brick.name}
                      href={brick.href}
                      className={clsx(
                        brick.status ? "cursor-pointer hover:bg-gray-50" : "cursor-default",
                        "-m-3 flex items-start rounded-lg p-3 py-3"
                      )}>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-teal-500 sm:h-12 sm:w-12">
                        <brick.icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="ml-4">
                        <p
                          className={clsx(
                            brick.status ? "text-gray-900" : "text-gray-400",
                            "text-lg font-semibold"
                          )}>
                          {brick.name}
                        </p>
                        <p className="text-sm text-gray-400">{brick.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div>
                  <h4 className="mt-8 mb-3 text-sm text-gray-500">Data Insights</h4>
                  {insights.map((brick) => (
                    <Link
                      key={brick.name}
                      href={brick.href}
                      className={clsx(
                        brick.status ? "cursor-pointer hover:bg-gray-50" : "cursor-default",
                        "-m-3 flex items-start rounded-lg p-3 py-3"
                      )}>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-teal-500 sm:h-12 sm:w-12">
                        <brick.icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="ml-4">
                        <p
                          className={clsx(
                            brick.status ? "text-gray-900" : "text-gray-400",
                            "text-lg font-semibold"
                          )}>
                          {brick.name}
                        </p>
                        <p className="text-sm text-gray-400">{brick.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </nav>
            </div>
            <div className="px-5 py-6">
              <div className="grid grid-cols-3 text-center text-sm font-medium text-gray-900 hover:text-gray-700 sm:text-base">
                <Link href="/community">Community</Link>

                <Link href="/blog">Blog</Link>

                <Link href="/docs">Documentation</Link>
              </div>
              <div className="mt-6">
                <Button
                  variant="secondary"
                  EndIcon={GitHubIcon}
                  onClick={() => router.push("https://github.com/formbricks/formbricks")}
                  className="flex w-full justify-center">
                  View on Github
                </Button>
                <Button
                  variant="primary"
                  onClick={() => router.push("https://app.formbricks.com")}
                  className="mt-3 flex w-full justify-center">
                  Get started
                </Button>
              </div>
            </div>
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}

function GitHubIcon(props: any) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" />
    </svg>
  );
}
