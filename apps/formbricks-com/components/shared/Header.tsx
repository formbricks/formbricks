import { Button } from "@formbricks/ui/Button";
import { Popover, Transition } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { usePlausible } from "next-plausible";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment } from "react";
import { FooterLogo } from "./Logo";
import { ThemeSelector } from "./ThemeSelector";

export default function Header() {
  /* 
  const [videoModal, setVideoModal] = useState(false); */
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
          <Link
            href="/community"
            className="text-base font-medium text-slate-400 hover:text-slate-700  dark:hover:text-slate-300">
            Community
          </Link>

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
            Blog{/*  <p className="bg-brand inline rounded-full px-2 text-xs text-white">1</p> */}
          </Link>
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
