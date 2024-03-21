import { Popover, Transition } from "@headlessui/react";
import { Menu, X } from "lucide-react";
import { usePlausible } from "next-plausible";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment } from "react";

import { Button } from "@formbricks/ui/Button";

import { FooterLogo } from "../shared/Logo";

const mainNav = [
  { name: "Link Surveys", href: "/open-source-form-builder", status: true },
  { name: "Website Surveys", href: "/website-survey", status: true },
  { name: "In-app Surveys", href: "/in-app-survey", status: true },
  { name: "Pricing", href: "/pricing", status: true },
];

export default function HeaderLight() {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <header className="max-w-8xl mx-auto flex items-center justify-between px-6 py-6 lg:px-10 xl:px-12">
      <Link href="/">
        <span className="sr-only">Formbricks</span>
        <FooterLogo className="h-8 w-auto sm:h-10" />
      </Link>

      <div className="hidden w-auto justify-around lg:block">
        {mainNav.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="px-4 text-sm font-medium text-slate-400 hover:text-slate-700 lg:px-6 lg:text-base xl:px-8  dark:hover:text-slate-300">
            {item.name}
          </Link>
        ))}
      </div>
      <Button
        variant="highlight"
        className="hidden whitespace-nowrap md:px-6 lg:block"
        onClick={() => {
          router.push("https://app.formbricks.com/auth/signup");
          plausible("Header_CTA_GetStarted");
        }}>
        Get started - it&apos;s free!
      </Button>

      <Popover className="block lg:hidden">
        <Popover.Button className="inline-flex items-center justify-center rounded-md bg-slate-100 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 lg:hidden dark:bg-slate-700 dark:text-slate-200">
          <span className="sr-only">Open menu</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </Popover.Button>
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
                      <X className="h-6 w-6" aria-hidden="true" />
                    </Popover.Button>
                  </div>
                </div>
              </div>
              <div className="px-5 py-6">
                <div className="flex flex-col space-y-5 text-center text-sm dark:text-slate-300">
                  <div className="space-y-4">
                    {mainNav.map((item) => (
                      <Link key={item.name} href={item.href} className="block text-lg text-slate-700">
                        {item.name}
                      </Link>
                    ))}
                    <Button
                      variant="primary"
                      onClick={() => router.push("https://app.formbricks.com/auth/signup")}
                      className="flex w-full justify-center text-lg">
                      Get started, it&apos;s free!
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Popover.Panel>
        </Transition>
      </Popover>
    </header>
  );
}
