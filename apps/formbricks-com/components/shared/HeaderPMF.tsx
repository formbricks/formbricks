import { Popover, Transition } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment } from "react";
import { Button } from "@formbricks/ui";
import { FooterLogo } from "./Logo";
import { ThemeSelector } from "./ThemeSelector";
import { usePlausible } from "next-plausible";

export default function Header() {
  const router = useRouter();
  const plausible = usePlausible();
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
          <Link
            href="#howitworks"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            How it works
          </Link>
          <Link
            href="#pricing"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Pricing <p className="bg-brand inline rounded-full px-2 text-xs text-white">50%</p>
          </Link>
          <Link
            href="/docs"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Docs
          </Link>
        </Popover.Group>
        <div className="hidden flex-1 items-center justify-end md:flex">
          <ThemeSelector className="relative z-10 mr-5" />
          <Button
            variant="secondary"
            className="ml-2"
            onClick={() => {
              plausible("openDemo");
              window.open("https://app.formbricks.com/demo", "_blank")?.focus();
            }}>
            Try Demo
          </Button>
          <Button
            variant="highlight"
            className="ml-2"
            onClick={() => {
              plausible("openSignUp");
              window.open("https://app.formbricks.com/auth/signup", "_blank")?.focus();
            }}>
            Sign Up
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
            <div className="px-5 pt-5 pb-6">
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
                <Link href="#howitworks">How it works</Link>
                <Link href="#pricing">Pricing</Link>
                <Link href="/docs">Docs</Link>
                <Button
                  variant="secondary"
                  target="_blank"
                  onClick={() => router.push("https://app.formbricks.com/demo")}
                  className="flex w-full justify-center fill-slate-800 dark:fill-slate-200">
                  Try Demo
                </Button>
                <Button
                  variant="primary"
                  target="_blank"
                  onClick={() => router.push("https://app.formbricks.com/auth/signup")}
                  className="flex w-full justify-center">
                  Sign Up
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
