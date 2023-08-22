import GitHubMarkWhite from "@/images/github-mark-white.svg";
import GitHubMarkDark from "@/images/github-mark.svg";
import {
  BaseballIcon,
  Button,
  CancelSubscriptionIcon,
  CodeBookIcon,
  DogChaserIcon,
  FeedbackIcon,
  InterviewPromptIcon,
  OnboardingIcon,
  PMFIcon,
} from "@formbricks/ui";
import { Popover, Transition } from "@headlessui/react";
import { Bars3Icon, ChevronDownIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { usePlausible } from "next-plausible";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useState } from "react";
import { FooterLogo } from "./Logo";
import { ThemeSelector } from "./ThemeSelector";

function GitHubIcon(props: any) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" />
    </svg>
  );
}

const UnderstandUsers = [
  {
    name: "Interview Prompt",
    href: "/interview-prompt",
    status: true,
    icon: InterviewPromptIcon,
    description: "Interview invites on auto-pilot",
  },
  {
    name: "Measure PMF",
    href: "/measure-product-market-fit",
    status: true,
    icon: PMFIcon,
    description: "Improve Product-Market Fit",
  },
  {
    name: "Onboarding Segments",
    href: "/onboarding-segmentation",
    status: true,
    icon: OnboardingIcon,
    description: "Get it right from the start",
  },
];

const IncreaseRevenue = [
  {
    name: "Learn from Churn",
    href: "/learn-from-churn",
    status: true,
    icon: CancelSubscriptionIcon,
    description: "Churn is hard, but insightful",
  },
  {
    name: "Improve Trial CR",
    href: "/improve-trial-conversion",
    status: true,
    icon: BaseballIcon,
    description: "Take guessing out, hit it right",
  },
];

const BoostRetention = [
  {
    name: "Feedback Box",
    href: "/feedback-box",
    status: true,
    icon: FeedbackIcon,
    description: "Always keep an ear open",
  },
  {
    name: "Docs Feedback",
    href: "/docs-feedback",
    status: true,
    icon: CodeBookIcon,
    description: "Clear docs, more adoption",
  },
  {
    name: "Feature Chaser",
    href: "/feature-chaser",
    status: true,
    icon: DogChaserIcon,
    description: "Follow up, improve",
  },
];

export default function Header() {
  const [mobileSubOpen, setMobileSubOpen] = useState(false);
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <Popover className="relative" as="header">
      <div className="flex items-center justify-between px-4 py-6 sm:px-6 md:justify-start ">
        <div className="flex w-0 flex-1 justify-start">
          <Link href="/">
            <span className="sr-only">Formbricks</span>
            <FooterLogo className="h-8 w-auto sm:h-10" />
          </Link>
        </div>
        <div className="-my-2 -mr-2 md:hidden">
          <Popover.Button className="inline-flex items-center justify-center rounded-md bg-slate-100 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 dark:bg-slate-700 dark:text-slate-200">
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
                      ? "text-slate-600 dark:text-slate-400 "
                      : "text-slate-400  hover:text-slate-900  dark:hover:text-slate-100",
                    "group inline-flex items-center rounded-md text-base font-medium hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:hover:text-slate-50"
                  )}>
                  <span>Best Practices</span>
                  <ChevronDownIcon
                    className={clsx(
                      open ? "text-slate-600" : "text-slate-400",
                      "ml-2 h-5 w-5 group-hover:text-slate-500"
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
                  <Popover.Panel className="absolute z-10 -ml-4 mt-3 w-screen max-w-lg transform lg:left-1/2 lg:ml-0 lg:max-w-4xl lg:-translate-x-1/2">
                    <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="relative grid gap-6 bg-white px-5 py-6 dark:bg-slate-700 sm:gap-6 sm:p-8 lg:grid-cols-3">
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-slate-400 dark:text-slate-300">
                            Understand Users
                          </h4>
                          {UnderstandUsers.map((brick) => (
                            <Link
                              key={brick.name}
                              href={brick.href}
                              className={clsx(
                                brick.status
                                  ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600"
                                  : "cursor-default",
                                "-m-3 flex items-start rounded-lg p-3 py-4"
                              )}>
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-teal-500 sm:h-12 sm:w-12">
                                <brick.icon className="h-6 w-6" aria-hidden="true" />
                              </div>
                              <div className="ml-4">
                                <p
                                  className={clsx(
                                    brick.status ? "text-slate-900 dark:text-slate-100" : "text-slate-400",
                                    "font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">{brick.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-slate-400 dark:text-slate-300">
                            Increase Revenue
                          </h4>
                          {IncreaseRevenue.map((brick) => (
                            <Link
                              key={brick.name}
                              href={brick.href}
                              className={clsx(
                                brick.status
                                  ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600"
                                  : "cursor-default",
                                "-m-3 flex items-start rounded-lg p-3 py-4"
                              )}>
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-teal-500 sm:h-12 sm:w-12">
                                <brick.icon className="h-6 w-6" aria-hidden="true" />
                              </div>
                              <div className="ml-4">
                                <p
                                  className={clsx(
                                    brick.status ? "text-slate-900 dark:text-slate-100" : "text-slate-400",
                                    " font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">{brick.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-slate-400 dark:text-slate-300">
                            Boost Retention
                          </h4>
                          {BoostRetention.map((brick) => (
                            <Link
                              key={brick.name}
                              href={brick.href}
                              className={clsx(
                                brick.status
                                  ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600"
                                  : "cursor-default",
                                "-m-3 flex items-start rounded-lg p-3 py-4"
                              )}>
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-teal-500 sm:h-12 sm:w-12">
                                <brick.icon className="h-6 w-6" aria-hidden="true" />
                              </div>
                              <div className="ml-4">
                                <p
                                  className={clsx(
                                    brick.status ? "text-slate-900 dark:text-slate-100" : "text-slate-400",
                                    " font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">{brick.description}</p>
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
          {/*           <Link
            href="/community"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Community
          </Link>
 */}
          <Link
            href="https://formbricks.com/#pricing"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Pricing
          </Link>
          <Link
            href="/docs"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Docs
          </Link>
          <Link
            href="/blog"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Blog {/* <p className="bg-brand inline rounded-full px-2 text-xs text-white">1</p> */}
          </Link>
          {/*           <Link
            href="/careers"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Careers <p className="bg-brand inline rounded-full px-2 text-xs text-white">2</p>
          </Link> */}

          <Link
            href="/concierge"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Concierge
          </Link>
        </Popover.Group>
        <div className="hidden flex-1 items-center justify-end md:flex">
          <ThemeSelector className="relative z-10 mr-5" />
          <Button
            variant="secondary"
            className="group px-2"
            href="https://formbricks.com/github"
            target="_blank">
            <Image
              src={GitHubMarkDark}
              alt="GitHub Sponsors Formbricks badge"
              width={24}
              className="block dark:hidden"
            />
            <Image
              src={GitHubMarkWhite}
              alt="GitHub Sponsors Formbricks badge"
              width={24}
              className="hidden dark:block"
            />
          </Button>
          {/*           <Button variant="secondary" className="ml-2 px-2" onClick={() => setVideoModal(true)}>
            <VideoWalkThrough open={videoModal} setOpen={() => setVideoModal(false)} />
            <PlayCircleIcon className="h-6 w-6" />
          </Button> */}

          <Button
            variant="highlight"
            className="ml-2"
            onClick={() => {
              router.push("https://app.formbricks.com");
              plausible("NavBar_CTA_Login");
            }}>
            Go to app
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
          <div className="dark:divide-slate divide-y-2 divide-slate-100 rounded-lg bg-slate-200 shadow-lg ring-1 ring-black ring-opacity-5 dark:divide-slate-700 dark:bg-slate-800">
            <div className="px-5 pb-6 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <FooterLogo className="h-8 w-auto" />
                </div>
                <div className="-mr-2">
                  <Popover.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 dark:bg-slate-700 dark:text-slate-200">
                    <span className="sr-only">Close menu</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </Popover.Button>
                </div>
              </div>
            </div>
            <div className="px-5 py-6">
              <div className="flex flex-col space-y-5 text-center text-sm dark:text-slate-300">
                <div>
                  {mobileSubOpen ? (
                    <ChevronDownIcon className="mr-2 inline h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="mr-2 inline h-4 w-4" />
                  )}
                  <button onClick={() => setMobileSubOpen(!mobileSubOpen)}>Best Practices</button>
                </div>
                {mobileSubOpen && (
                  <div className="flex flex-col space-y-5 text-center text-sm dark:text-slate-300">
                    {UnderstandUsers.map((brick) => (
                      <Link href={brick.href} key={brick.name} className="font-semibold">
                        {brick.name}
                      </Link>
                    ))}
                    {IncreaseRevenue.map((brick) => (
                      <Link href={brick.href} key={brick.name} className="font-semibold">
                        {brick.name}
                      </Link>
                    ))}
                    {BoostRetention.map((brick) => (
                      <Link href={brick.href} key={brick.name} className="font-semibold">
                        {brick.name}
                      </Link>
                    ))}
                    <hr className="mx-20 my-6 opacity-25" />
                  </div>
                )}
                <Link href="/concierge">Concierge</Link>
                <Link href="#pricing">Pricing</Link>
                <Link href="/docs">Docs</Link>
                <Link href="/blog">Blog</Link>
                {/*   <Link href="/careers">Careers</Link> */}
                <Button
                  variant="secondary"
                  EndIcon={GitHubIcon}
                  onClick={() => router.push("https://github.com/formbricks/formbricks")}
                  className="flex w-full justify-center fill-slate-800 dark:fill-slate-200">
                  View on Github
                </Button>
                <Button
                  variant="primary"
                  onClick={() => router.push("https://app.formbricks.com/auth/signup")}
                  className="flex w-full justify-center">
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
