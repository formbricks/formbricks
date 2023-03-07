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
import { useEnvironment } from "@/lib/environments";
import { Disclosure } from "@headlessui/react";
import {
  ArrowRightOnRectangleIcon,
  CogIcon,
  CreditCardIcon,
  DocumentMagnifyingGlassIcon,
  HeartIcon,
  PlusIcon,
  RocketLaunchIcon,
  UserCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import type { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface EnvironmentsNavbarProps {
  environmentId: string;
  session: Session;
}

export default function EnvironmentsNavbar({ environmentId, session }: EnvironmentsNavbarProps) {
  const { environment } = useEnvironment(environmentId);
  const pathname = usePathname();

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
        href: `/environments/${environmentId}/settings/profile`,
        icon: SettingsIcon,
        current: pathname?.includes("/settings"),
      },
    ],
    [pathname]
  );

  return (
    <Disclosure as="nav" className="border-b border-slate-200 bg-white">
      {({}) => (
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
