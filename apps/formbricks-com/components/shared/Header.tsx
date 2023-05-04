import { Button } from "@formbricks/ui";
import { Popover, Transition } from "@headlessui/react";
import { Bars3Icon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { usePlausible } from "next-plausible";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment } from "react";
import { FooterLogo } from "./Logo";
import { ThemeSelector } from "./ThemeSelector";
import clsx from "clsx";
import {
  CancelSubscriptionIcon,
  DogChaserIcon,
  FeedbackIcon,
  InterviewPromptIcon,
  OnboardingIcon,
  PMFIcon,
  BaseballIcon,
  CodeBookIcon,
} from "@formbricks/ui";

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
    href: "/measure-pmf",
    status: true,
    icon: PMFIcon,
    description: "Improve Product-Market Fit",
  },
  {
    name: "Onboarding Segments",
    href: "/onboarding",
    status: false,
    icon: OnboardingIcon,
    description: "Get it right from the start",
  },
];

const IncreaseRevenue = [
  {
    name: "Learn from Churn",
    href: "/cancel-subscription-flow",
    status: true,
    icon: CancelSubscriptionIcon,
    description: "Churn is hard, but insightful",
  },
  {
    name: "Improve Trial CR",
    href: "/missed-trials",
    status: true,
    icon: BaseballIcon,
    description: "Take guessing out, hit right",
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
                      ? "text-gray-600 "
                      : "text-gray-400  hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50",
                    "group inline-flex items-center rounded-md text-base font-medium hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:hover:text-gray-50"
                  )}>
                  <span>Best Practices</span>
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
                  <Popover.Panel className="absolute z-10 -ml-4 mt-3 w-screen max-w-lg transform lg:left-1/2 lg:ml-0 lg:max-w-4xl lg:-translate-x-1/2">
                    <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="relative grid gap-6 bg-white px-5 py-6 sm:gap-6 sm:p-8 lg:grid-cols-3">
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-slate-400">Understand Users</h4>
                          {UnderstandUsers.map((brick) => (
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
                                    " font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-400">{brick.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-slate-400">Increase Revenue</h4>
                          {IncreaseRevenue.map((brick) => (
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
                                    " font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-400">{brick.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div>
                          <h4 className="mb-6 ml-16 text-sm text-slate-400">Boost Retention</h4>
                          {BoostRetention.map((brick) => (
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
                                    " font-semibold"
                                  )}>
                                  {brick.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-400">{brick.description}</p>
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
            Blog <p className="bg-brand inline rounded-full px-2 text-xs text-white">1</p>
          </Link>

          {/*           <Link
            href="/community"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Community
          </Link>
 */}
        </Popover.Group>
        <div className="hidden flex-1 items-center justify-end md:flex">
          <ThemeSelector className="relative z-10 mr-5" />
          <Button
            variant="secondary"
            className="group px-2"
            href="https://formbricks.com/github"
            target="_blank">
            <StarIcon className="h-6 w-6 text-amber-500 group-hover:text-amber-400" />
          </Button>
          {/*           <Button variant="secondary" className="ml-2 px-2" onClick={() => setVideoModal(true)}>
            <VideoWalkThrough open={videoModal} setOpen={() => setVideoModal(false)} />
            <PlayCircleIcon className="h-6 w-6" />
          </Button> */}

          {/*           <Button
            variant="secondary"
            EndIcon={GitHubIcon}
            endIconClassName="fill-slate-800 ml-2 dark:fill-slate-200"
            href="https://github.com/formbricks/formbricks"
            target="_blank">
            View on Github
          </Button> */}
          <Button
            variant="highlight"
            className="ml-2"
            onClick={() => {
              router.push("https://app.formbricks.com");
              plausible("NavBar_CTA_Login");
            }}>
            Login
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
                <Link href="/community">Community</Link>
                <Link href="#pricing">Pricing</Link>
                <Link href="/docs">Docs</Link>
                <Link href="/blog">Blog</Link>
                {/*                 <Button
                  variant="secondary"
                  EndIcon={GitHubIcon}
                  onClick={() => router.push("https://github.com/formbricks/formbricks")}
                  className="flex w-full justify-center fill-slate-800 dark:fill-slate-200">
                  View on Github
                </Button> */}
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
