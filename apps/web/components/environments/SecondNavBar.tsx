"use client";

import { useEnvironment } from "@/lib/environments";
import clsx from "clsx";
import type { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface SecondNavbarProps {
  tabs: [];
}

export default function SecondNavbar({ tabs }: SecondNavbarProps) {
  return (
    <Disclosure as="nav" className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white">
      {({}) => (
        <>
          <div className="w-full px-4 sm:px-6">
            <div className="flex h-14 justify-between">
              <div className="hidden py-2 sm:flex lg:space-x-4">
                <Link
                  href=""
                  className="from-brand-light to-brand-dark my-1 flex items-center justify-center rounded-md bg-gradient-to-b px-1 text-white transition-all ease-in-out hover:scale-105">
                  <PlusIcon className="h-6 w-6" />
                </Link>
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      item.current
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-900 hover:bg-slate-50 hover:text-slate-900",
                      "inline-flex items-center rounded-md py-1 px-2 text-sm font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}>
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Image
                      src={session.user.image || AvatarPlaceholder}
                      width="100"
                      height="100"
                      className="h-8 w-8 rounded-full"
                      alt="Avatar placeholder"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>
                      <span className="font-normal">Signed in as</span> {session.user.name}
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div>
                          <p>{environment?.product?.name}</p>
                          <p className=" block text-xs text-slate-500">Product</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem>
                            <span>{environment?.product?.name}</span>
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
                          <p>{environment?.type}</p>
                          <p className=" block text-xs text-slate-500">Environment</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup value={environment} onValueChange={() => {}}>
                            <DropdownMenuRadioItem value="production">Production</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="development">Development</DropdownMenuRadioItem>
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
              </div>
            </div>
          </div>
        </>
      )}
    </Disclosure>
  );
}
