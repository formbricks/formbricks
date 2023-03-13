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
} from "@/components/shared/DropdownMenu";
import { CustomersIcon } from "@/components/ui/icons/CustomersIcon";
import { DashboardIcon } from "@/components/ui/icons/DashboardIcon";
import { FilterIcon } from "@/components/ui/icons/FilterIcon";
import { FormIcon } from "@/components/ui/icons/FormIcon";
import { SettingsIcon } from "@/components/ui/icons/SettingsIcon";
import { useEnvironment } from "@/lib/environments";
import { capitalizeFirstLetter } from "@/lib/utils";
import { Disclosure } from "@headlessui/react";
import {
  AdjustmentsVerticalIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  CreditCardIcon,
  DocumentCheckIcon,
  HeartIcon,
  PaintBrushIcon,
  PlusIcon,
  RocketLaunchIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import type { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { ProfileAvatar } from "../ui/Avatars";
import { signOut } from "next-auth/react";

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
        href: `/environments/${environmentId}/events`,
        icon: FilterIcon,
        current: pathname?.includes("/events" || "/attributes"),
      },
      {
        name: "Integrations",
        href: `/environments/${environmentId}/integrations/installation`,
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
    [environmentId, pathname]
  );

  const dropdownnavigation = [
    {
      title: "Survey",
      links: [
        {
          icon: AdjustmentsVerticalIcon,
          label: "Survey Settings",
          href: `/environments/${environmentId}/settings/product`,
        },
        {
          icon: PaintBrushIcon,
          label: "Look & Feel",
          href: `/environments/${environmentId}/settings/lookandfeel`,
        },
      ],
    },
    {
      title: "Account",
      links: [
        {
          icon: UserCircleIcon,
          label: "Profile",
          href: `/environments/${environmentId}/settings/profile`,
        } /* 
        { icon: UsersIcon, label: "Team", href: `/environments/${environmentId}/settings/team` }, */,
        {
          icon: CreditCardIcon,
          label: "Billing & Plan",
          href: `/environments/${environmentId}/settings/billing`,
        },
        {
          icon: RocketLaunchIcon,
          label: "Upgrade account",
          href: `/environments/${environmentId}/settings/billing`,
        },
      ],
    },
    {
      title: "Setup",
      links: [
        {
          icon: DocumentCheckIcon,
          label: "Setup checklist",
          href: `/environments/${environmentId}/settings/setup`,
        },
        {
          icon: CodeBracketIcon,
          label: "Developer Docs",
          href: "https://formbricks.com/docs",
          target: "_blank",
        },
        {
          icon: HeartIcon,
          label: "Contribute to Formbricks",
          href: "https://formbricks.com/discord",
          target: "_blank",
        },
      ],
    },
    /*  {
      title: "Logout",
      links: [
        {
          icon: ArrowRightOnRectangleIcon,
          label: "Logout",
          onClick: async () => {
            try {
              await signOut({ callbackUrl: "http://app.formbricks.com/auth/login" });
            } catch (error) {
              console.error("Failed to sign out:", error);
            }
          },
        },
      ],
    }, */
  ];

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
                    <div className="flex cursor-pointer flex-row items-center space-x-5">
                      {session.user.image ? (
                        <Image
                          src={session.user.image}
                          width="100"
                          height="100"
                          className="h-9 w-9 rounded-full"
                          alt="Profile picture"
                        />
                      ) : (
                        <ProfileAvatar userId={session.user.id} />
                      )}

                      <div>
                        <p className="-mb-0.5 text-sm font-bold text-slate-700">
                          {environment?.product?.name}
                        </p>
                        <p className="text-sm text-slate-500">{capitalizeFirstLetter(environment?.type)}</p>
                      </div>
                      <ChevronDownIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                    </div>
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
                          <p>{capitalizeFirstLetter(environment?.type)}</p>
                          <p className=" block text-xs text-slate-500">Environment</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup value={environment?.type} onValueChange={() => {}}>
                            <DropdownMenuRadioItem value="production">Production</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="development">Development</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    {dropdownnavigation.map((item) => (
                      <DropdownMenuGroup key={item.title}>
                        <DropdownMenuSeparator />
                        {item.links.map((link) => (
                          <Link href={link.href} target={link.target} key={link.label}>
                            <DropdownMenuItem key={link.label}>
                              <div className="flex items-center">
                                <link.icon className="mr-2 h-4 w-4" />
                                <span>{link.label}</span>
                              </div>
                            </DropdownMenuItem>
                          </Link>
                        ))}
                      </DropdownMenuGroup>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem>
                        <div className="flex items-center">
                          <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                          <button
                            onClick={async () => {
                              try {
                                await signOut();
                              } catch (error) {
                                console.error("Failed to sign out:", error);
                              }
                            }}>
                            Logout
                          </button>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
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
