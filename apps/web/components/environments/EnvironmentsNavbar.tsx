"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { CustomersIcon } from "@/components/ui/icons/CustomersIcon";
import { DashboardIcon } from "@/components/ui/icons/DashboardIcon";
import { FilterIcon } from "@/components/ui/icons/FilterIcon";
import { FormIcon } from "@/components/ui/icons/FormIcon";
import { SettingsIcon } from "@/components/ui/icons/SettingsIcon";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  CogIcon,
  CreditCardIcon,
  DocumentMagnifyingGlassIcon,
  HeartIcon,
  PlusIcon,
  RocketLaunchIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo } from "react";
import { useState } from "react";

export default function EnvironmentsNavbar({ environmentId }) {
  const pathname = usePathname();
  const userNavigation = useMemo(
    () => [
      {
        name: "Settings",
        href: "/me/settings",
      },
    ],
    []
  );

  const navigation = useMemo(
    () => [
      {
        name: "Surveys",
        href: `/environments/${environmentId}/surveys`,
        icon: FormIcon,
        current: pathname?.includes("/surveys"),
      },
      {
        name: "People",
        href: `/environments/${environmentId}/people`,
        icon: CustomersIcon,
        current: pathname?.includes("/people"),
      },
      {
        name: "Events & Attributes",
        href: `/environments/${environmentId}/events-attributes`,
        icon: FilterIcon,
        current: pathname?.includes("/events-attributes"),
      },
      {
        name: "Integrations",
        href: `/environments/${environmentId}/integrations`,
        icon: DashboardIcon,
        current: pathname?.includes("/integrations"),
      },
      {
        name: "Settings",
        href: `/environments/${environmentId}/settings`,
        icon: SettingsIcon,
        current: pathname?.includes("/settings"),
      },
    ],
    [pathname]
  );

  let EnvironmentDescription = "Production";
  const [environment, setEnvironment] = useState("prod");

  //write a function which changes the text of "Environment" to the name of the environment

  if (environment === "prod") {
    EnvironmentDescription = "Production";
  } else if (environment === "dev") {
    EnvironmentDescription = "Development";
  }

  return (
    <Disclosure as="nav" className="border-b border-slate-200 bg-white">
      {({ open }) => (
        <>
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="hidden py-2 sm:flex lg:space-x-4">
                <Link
                  href=""
                  className="from-brand-light to-brand-dark flex items-center justify-center rounded-md bg-gradient-to-b px-1.5 text-white transition-all ease-in-out hover:scale-105">
                  <PlusIcon className="h-8 w-8" />
                </Link>
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      item.current
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-900 hover:bg-slate-50 hover:text-slate-900",
                      "inline-flex items-center rounded-md py-2 px-3 text-sm font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}>
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                {/* <button
                      type="button"
                      className="rounded-full bg-white p-1 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                      <span className="sr-only">View notifications</span>
                      <BellIcon className="h-6 w-6" aria-hidden="true" />
                    </button> 

                {/* Profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Image
                      src={AvatarPlaceholder}
                      width="100"
                      height="100"
                      className="h-8 w-8 rounded-full"
                      alt="Avatar placeholder"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>
                      <span className="font-normal">Signed in as</span> Johannes
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div>
                          <p>Productname</p>
                          <p className=" block text-xs text-slate-500">Product</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem>
                            <span>Formbricks</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            <span>Add product</span>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div>
                          <p>{EnvironmentDescription}</p>
                          <p className=" block text-xs text-slate-500">Environment</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup value={environment} onValueChange={setEnvironment}>
                            <DropdownMenuRadioItem value="prod">Production</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dev">Development</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuGroup>
                      <DropdownMenuItem>
                        <UserCircleIcon className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <UsersIcon className="mr-2 h-4 w-4" />
                        <span>Team</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <CreditCardIcon className="mr-2 h-4 w-4" />
                        <span>Billing & Plans</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem>
                        <CogIcon className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem>
                        <DocumentMagnifyingGlassIcon className="mr-2 h-4 w-4" />
                        <span>Documentation</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem>
                        <RocketLaunchIcon className="mr-2 h-4 w-4" />
                        <span>Upgrade account</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                      <HeartIcon className="text-red mr-2 h-4 w-4" />
                      <span>Contribute to Formbricks</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                      <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Menu as="div" className="relative ml-3">
                  <div>
                    <Menu.Button className="focus:ring-brand flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-offset-2">
                      <span className="sr-only">Open user menu</span>
                      <Image
                        src={AvatarPlaceholder}
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
                        <p className="truncate text-sm font-medium text-slate-900">Username Placeholder</p>
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
                      {/* {process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD === "1" &&
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
                        ))} */}
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
                  <Image className="h-10 w-10 rounded-full" src={AvatarPlaceholder} alt="profile picture" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-slate-800">Username Placeholder</div>
                  <div className="text-sm font-medium text-slate-500">Email Placeholder</div>
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
  );
}
