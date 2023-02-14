"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";
import { useMemberships } from "@/lib/memberships";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useMemo } from "react";
import { ToastContainer } from "react-toastify";
import { Logo } from "../Logo";

export default function LayoutApp({ children }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { memberships, isLoadingMemberships, isErrorMemberships } = useMemberships();

  const userNavigation = useMemo(
    () => [
      {
        name: "Settings",
        href: "/me/settings",
      },
    ],
    []
  );

  if (status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`);
    return <LoadingSpinner />;
  }

  if (isLoadingMemberships) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorMemberships) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  if (session && session.user.finishedOnboarding === false && router.pathname !== "/me/onboarding") {
    // use timeout to prevent flash of content and resulting errors
    router.push("/me/onboarding");
    return <LoadingSpinner />;
  }

  return (
    <>
      <Head>
        <title>Formbricks</title>
        <meta name="description" content="Build user research into your product" />
      </Head>
      <div className="">
        <Disclosure as="nav" className="border-b border-slate-200 bg-white">
          {({ open }) => (
            <>
              <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 justify-between">
                  <div className="flex">
                    <div className="flex flex-shrink-0 items-center">
                      <Link href="/">
                        <Logo className="block h-8 w-auto" />
                      </Link>
                    </div>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:items-center">
                    {/* <button
                      type="button"
                      className="rounded-full bg-white p-1 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                      <span className="sr-only">View notifications</span>
                      <BellIcon className="h-6 w-6" aria-hidden="true" />
                    </button> */}

                    {/* Profile dropdown */}
                    <Menu as="div" className="relative ml-3">
                      <div>
                        <Menu.Button className="focus:ring-brand flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-offset-2">
                          <span className="sr-only">Open user menu</span>
                          <Image
                            src={session.user.image || AvatarPlaceholder}
                            width="100"
                            height="100"
                            className="h-8 w-8 rounded-full"
                            alt="Avatar placeholder"
                          />
                        </Menu.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95">
                        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right divide-y divide-slate-100 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                          <div className="px-4 py-3">
                            <p className="text-sm">Signed in as</p>
                            <p className="truncate text-sm font-medium text-slate-900">{session.user.name}</p>
                          </div>
                          <div className="py-1">
                            {userNavigation.map((item) => (
                              <Menu.Item key={item.name}>
                                {({ active }) => (
                                  <Link
                                    href={item.href}
                                    className={clsx(
                                      active ? "bg-slate-100" : "",
                                      "flex justify-start px-4 py-2 text-sm text-slate-700"
                                    )}>
                                    {item.name}
                                  </Link>
                                )}
                              </Menu.Item>
                            ))}
                          </div>
                          {process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD === "1" &&
                            memberships.map((membership) => (
                              <>
                                <div className="px-4 py-3">
                                  <p className="truncate text-sm font-medium text-slate-900">
                                    {membership.organisation.name}
                                  </p>
                                </div>
                                <div className="py-1">
                                  <Menu.Item>
                                    {({ active }) => (
                                      <Link
                                        href={`/organisations/${membership.organisation.id}/settings/billing`}
                                        className={clsx(
                                          active ? "bg-slate-100" : "",
                                          "flex justify-start px-4 py-2 text-sm text-slate-700"
                                        )}>
                                        Billing
                                      </Link>
                                    )}
                                  </Menu.Item>
                                </div>
                              </>
                            ))}
                          <div className="py-1">
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() =>
                                    signOut({
                                      callbackUrl: `${window.location.protocol}//${window.location.host}/`,
                                    })
                                  }
                                  className={clsx(
                                    active ? "bg-slate-100" : "",
                                    "flex w-full justify-start px-4 py-2 text-sm text-slate-700"
                                  )}>
                                  Sign out
                                </button>
                              )}
                            </Menu.Item>
                          </div>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </div>
                  <div className="-mr-2 flex items-center sm:hidden">
                    {/* Mobile menu button */}
                    <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                      <span className="sr-only">Open main menu</span>
                      {open ? (
                        <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                      ) : (
                        <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                      )}
                    </Disclosure.Button>
                  </div>
                </div>
              </div>

              <Disclosure.Panel className="sm:hidden">
                <div className="border-t border-slate-200 pt-4 pb-3">
                  <div className="flex items-center px-4">
                    <div className="flex-shrink-0">
                      <Image
                        className="h-10 w-10 rounded-full"
                        src={session.user.image || AvatarPlaceholder}
                        alt="profile picture"
                      />
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium text-slate-800">{session.user.name}</div>
                      <div className="text-sm font-medium text-slate-500">{session.user.email}</div>
                    </div>
                    {/*  <button
                      type="button"
                      className="ml-auto flex-shrink-0 rounded-full bg-white p-1 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                      <span className="sr-only">View notifications</span>
                      <BellIcon className="h-6 w-6" aria-hidden="true" />
                    </button> */}
                  </div>
                  <div className="mt-3 space-y-1">
                    {userNavigation.map((item) => (
                      <Disclosure.Button
                        key={item.name}
                        as="a"
                        href={item.href}
                        className="block px-4 py-2 text-base font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                        {item.name}
                      </Disclosure.Button>
                    ))}
                  </div>
                </div>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>

        <main className="min-h-screen bg-slate-50">{children}</main>
        <ToastContainer />
      </div>
    </>
  );
}
