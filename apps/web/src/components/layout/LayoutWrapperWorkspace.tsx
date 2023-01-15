"use client";

import { Logo } from "@/components/Logo";
import { CustomersIcon, FormIcon } from "@formbricks/ui";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/router";
import { Fragment, useMemo, useState } from "react";

export default function LayoutWrapperWorkspace({ children }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const sidebarNavigation = useMemo(
    () => [
      {
        name: "Forms",
        href: `/workspaces/${router.query.workspaceId}/forms`,
        icon: FormIcon,
        current: pathname.includes("/form"),
      },
      {
        name: "Customers",
        href: `/workspaces/${router.query.workspaceId}/customers`,
        icon: CustomersIcon,
        current: pathname.includes("/customers"),
      },
      /*     {
        name: "Settings",
        href: `/workspaces/${router.query.workspaceId}/settings`,
        icon: Cog8ToothIcon,
        current: pathname.includes("/settings"),
      }, */
    ],
    [router.query, pathname]
  );

  return (
    <>
      <div className="flex h-full">
        {/* Narrow sidebar */}
        <div className="hidden overflow-y-auto border-r border-gray-200 bg-white bg-gradient-to-r md:block md:w-64">
          <div className="flex w-full flex-col items-center py-6">
            <div className="w-full flex-1 space-y-2 px-2">
              {sidebarNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    item.current
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    "group flex items-center rounded-md px-2 py-2 text-sm font-medium"
                  )}>
                  <item.icon
                    className={clsx(
                      item.current ? "text-gray-500" : "text-gray-400 group-hover:text-gray-500",
                      "mr-3 h-6 w-6 flex-shrink-0"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <Transition.Root show={mobileMenuOpen} as={Fragment}>
          <Dialog as="div" className="relative z-20 md:hidden" onClose={setMobileMenuOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0">
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            </Transition.Child>

            <div className="fixed inset-0 z-40 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full">
                <Dialog.Panel className="bg-brand-light relative flex w-full max-w-xs flex-1 flex-col pt-5 pb-4">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0">
                    <div className="absolute top-1 right-0 -mr-14 p-1">
                      <button
                        type="button"
                        className="flex h-12 w-12 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-white"
                        onClick={() => setMobileMenuOpen(false)}>
                        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                        <span className="sr-only">Close sidebar</span>
                      </button>
                    </div>
                  </Transition.Child>
                  <div className="flex flex-shrink-0 items-center px-4">
                    <Logo className="h-8 w-auto" />
                  </div>
                  <div className="mt-5 h-0 flex-1 overflow-y-auto px-2">
                    <nav className="flex h-full flex-col">
                      <div className="space-y-1">
                        {sidebarNavigation.map((item) => (
                          <a
                            key={item.name}
                            href={item.href}
                            className={clsx(
                              item.current
                                ? "bg-brand-dark text-white"
                                : "hover:bg-brand-dark text-teal-100 hover:text-white",
                              "group flex items-center rounded-md py-2 px-3 text-sm font-medium"
                            )}
                            aria-current={item.current ? "page" : undefined}>
                            <item.icon
                              className={clsx(
                                item.current ? "text-white" : "text-teal-300 group-hover:text-white",
                                "mr-3 h-6 w-6"
                              )}
                              aria-hidden="true"
                            />
                            <span>{item.name}</span>
                          </a>
                        ))}
                      </div>
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
              <div className="w-14 flex-shrink-0" aria-hidden="true">
                {/* Dummy element to force sidebar to shrink to fit close icon */}
              </div>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Main content */}
          <div className="flex flex-1 items-stretch overflow-hidden">
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </div>
    </>
  );
}
