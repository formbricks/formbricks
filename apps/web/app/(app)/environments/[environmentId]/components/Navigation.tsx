"use client";

import FaveIcon from "@/app/favicon.ico";
import { formbricksLogout } from "@/app/lib/formbricks";
import clsx from "clsx";
import {
  BrushIcon,
  ChevronDownIcon,
  CodeIcon,
  CreditCardIcon,
  FileCheckIcon,
  HeartIcon,
  LinkIcon,
  LogOutIcon,
  MailIcon,
  MessageSquareTextIcon,
  PlusIcon,
  SlidersIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react";
import { MenuIcon } from "lucide-react";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import formbricks from "@formbricks/js";
import { cn } from "@formbricks/lib/cn";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { capitalizeFirstLetter, truncate } from "@formbricks/lib/strings";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TTeam } from "@formbricks/types/teams";
import { ProfileAvatar } from "@formbricks/ui/Avatars";
import CreateTeamModal from "@formbricks/ui/CreateTeamModal";
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
} from "@formbricks/ui/DropdownMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui/Popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { CustomersIcon, DashboardIcon, FilterIcon, FormIcon, SettingsIcon } from "@formbricks/ui/icons";

import AddProductModal from "./AddProductModal";
import UrlShortenerModal from "./UrlShortenerModal";

interface NavigationProps {
  environment: TEnvironment;
  teams: TTeam[];
  session: Session;
  team: TTeam;
  products: TProduct[];
  environments: TEnvironment[];
  isFormbricksCloud: boolean;
  webAppUrl: string;
  membershipRole?: TMembershipRole;
}

export default function Navigation({
  environment,
  teams,
  team,
  session,
  products,
  environments,
  isFormbricksCloud,
  webAppUrl,
  membershipRole,
}: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentTeamName, setCurrentTeamName] = useState("");
  const [currentTeamId, setCurrentTeamId] = useState("");
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showLinkShortenerModal, setShowLinkShortenerModal] = useState(false);
  const product = products.find((product) => product.id === environment.productId);
  const [mobileNavMenuOpen, setMobileNavMenuOpen] = useState(false);
  const { isAdmin, isOwner, isViewer } = getAccessFlags(membershipRole);
  const isPricingDisabled = !isOwner && !isAdmin;

  useEffect(() => {
    if (environment && environment.widgetSetupCompleted) {
      setWidgetSetupCompleted(true);
    } else {
      setWidgetSetupCompleted(false);
    }
  }, [environment]);

  useEffect(() => {
    if (team && team.name !== "") {
      setCurrentTeamName(team.name);
      setCurrentTeamId(team.id);
    }
  }, [team]);

  const navigation = useMemo(
    () => [
      {
        name: "Surveys",
        href: `/environments/${environment.id}/surveys`,
        icon: FormIcon,
        current: pathname?.includes("/surveys"),
        hidden: false,
      },
      {
        name: "People & Segments",
        href: `/environments/${environment.id}/people`,
        icon: CustomersIcon,
        current: pathname?.includes("/people") || pathname?.includes("/segments"),
      },
      {
        name: "Actions & Attributes",
        href: `/environments/${environment.id}/actions`,
        icon: FilterIcon,
        current: pathname?.includes("/actions") || pathname?.includes("/attributes"),
        hidden: false,
      },
      {
        name: "Integrations",
        href: `/environments/${environment.id}/integrations`,
        icon: DashboardIcon,
        current: pathname?.includes("/integrations"),
        hidden: isViewer,
      },
      {
        name: "Settings",
        href: `/environments/${environment.id}/settings/profile`,
        icon: SettingsIcon,
        current: pathname?.includes("/settings"),
        hidden: false,
      },
    ],
    [environment.id, pathname, isViewer]
  );

  const dropdownNavigation = [
    {
      title: "Survey",
      links: [
        {
          icon: SlidersIcon,
          label: "Product Settings",
          href: `/environments/${environment.id}/settings/product`,
          hidden: false,
        },
        {
          icon: BrushIcon,
          label: "Look & Feel",
          href: `/environments/${environment.id}/settings/lookandfeel`,
          hidden: isViewer,
        },
      ],
    },
    {
      title: "Account",
      links: [
        {
          icon: UserCircleIcon,
          label: "Profile",
          href: `/environments/${environment.id}/settings/profile`,
        },
        { icon: UsersIcon, label: "Team", href: `/environments/${environment.id}/settings/members` },
        {
          icon: CreditCardIcon,
          label: "Billing & Plan",
          href: `/environments/${environment.id}/settings/billing`,
          hidden: !isFormbricksCloud || isPricingDisabled,
        },
      ],
    },
    {
      title: "Setup",
      links: [
        {
          icon: FileCheckIcon,
          label: "Setup checklist",
          href: `/environments/${environment.id}/settings/setup`,
          hidden: widgetSetupCompleted,
        },
        {
          icon: LinkIcon,
          label: "Link Shortener",
          href: pathname,
          onClick: () => {
            setShowLinkShortenerModal(true);
          },
        },
        {
          icon: CodeIcon,
          label: "Developer Docs",
          href: "https://formbricks.com/docs",
          target: "_blank",
        },
        {
          icon: HeartIcon,
          label: "Contribute to Formbricks",
          href: "https://github.com/formbricks/formbricks",
          target: "_blank",
        },
      ],
    },
  ];

  const handleEnvironmentChange = (environmentType: "production" | "development") => {
    const newEnvironmentId = environments.find((e) => e.type === environmentType)?.id;
    if (newEnvironmentId) {
      router.push(`/environments/${newEnvironmentId}/`);
    }
  };

  const handleEnvironmentChangeByProduct = (productId: string) => {
    router.push(`/products/${productId}/`);
  };

  const handleEnvironmentChangeByTeam = (teamId: string) => {
    router.push(`/teams/${teamId}/`);
  };

  if (pathname?.includes("/edit")) return null;

  return (
    <>
      {product && (
        <nav className="top-0 w-full border-b border-slate-200 bg-white">
          {environment?.type === "development" && (
            <div className="h-6 w-full bg-[#A33700] p-0.5 text-center text-sm text-white">
              You&apos;re in development mode. Use it to test surveys, actions and attributes.
            </div>
          )}

          <div className="w-full px-4 sm:px-6">
            <div className="flex h-14 justify-between">
              <div className="flex space-x-4 py-2">
                <Link
                  href={`/environments/${environment.id}/surveys/`}
                  className="flex items-center justify-center rounded-md bg-gradient-to-b text-white transition-all ease-in-out hover:scale-105">
                  <Image src={FaveIcon} width={30} height={30} alt="faveicon" />
                </Link>

                {navigation.map((item) => {
                  const IconComponent: React.ElementType = item.icon;

                  return (
                    !item.hidden && (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={clsx(
                          item.current
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-900 hover:bg-slate-50 hover:text-slate-900",
                          "hidden items-center rounded-md px-2 py-1 text-sm font-medium lg:inline-flex"
                        )}
                        aria-current={item.current ? "page" : undefined}>
                        <IconComponent className="mr-3 h-5 w-5" />
                        {item.name}
                      </Link>
                    )
                  );
                })}
              </div>

              {/* Mobile Menu */}
              <div className="flex items-center lg:hidden">
                <Popover open={mobileNavMenuOpen} onOpenChange={setMobileNavMenuOpen}>
                  <PopoverTrigger onClick={() => setMobileNavMenuOpen(!mobileNavMenuOpen)}>
                    <span>
                      <MenuIcon className="h-6 w-6 rounded-md bg-slate-200 p-1 text-slate-600" />
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="mr-4 bg-slate-100 shadow">
                    <div className="flex flex-col">
                      {navigation.map(
                        (navItem) =>
                          !navItem.hidden && (
                            <Link key={navItem.name} href={navItem.href}>
                              <div
                                onClick={() => setMobileNavMenuOpen(false)}
                                className={cn(
                                  "flex items-center space-x-2 rounded-md p-2",
                                  navItem.current && "bg-slate-200"
                                )}>
                                <navItem.icon className="h-5 w-5" />
                                <span className="font-medium text-slate-600">{navItem.name}</span>
                              </div>
                            </Link>
                          )
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* User Dropdown */}
              <div className="hidden lg:ml-6 lg:flex lg:items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild id="userDropdownTrigger">
                    <div tabIndex={0} className="flex cursor-pointer flex-row items-center space-x-5">
                      {session.user.imageUrl ? (
                        <Image
                          src={session.user.imageUrl}
                          width="40"
                          height="40"
                          className="ph-no-capture h-10 w-10 rounded-full"
                          alt="Profile picture"
                        />
                      ) : (
                        <ProfileAvatar userId={session.user.id} />
                      )}

                      <div>
                        <p className="ph-no-capture ph-no-capture -mb-0.5 text-sm font-bold text-slate-700">
                          {truncate(product!.name, 30)}
                        </p>
                        <p className="text-sm text-slate-500">{capitalizeFirstLetter(team?.name)}</p>
                      </div>
                      <ChevronDownIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" id="userDropdownContentWrapper">
                    <DropdownMenuLabel className="cursor-default break-all">
                      <span className="ph-no-capture font-normal">Signed in as </span>
                      {session?.user?.name && session?.user?.name.length > 30 ? (
                        <TooltipProvider delayDuration={50}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{truncate(session?.user?.name, 30)}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[45rem] break-all" side="left" sideOffset={5}>
                              {session?.user?.name}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        session?.user?.name
                      )}
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    {/* Product Switch */}

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div>
                          <div className="flex items-center space-x-1">
                            <p className="">{truncate(product!.name, 20)}</p>
                            {!widgetSetupCompleted && (
                              <TooltipProvider delayDuration={50}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500 hover:bg-amber-600"></div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Your app is not connected to Formbricks.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className=" block text-xs text-slate-500">Product</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="max-w-[45rem]">
                          <DropdownMenuRadioGroup
                            value={product!.id}
                            onValueChange={(v) => handleEnvironmentChangeByProduct(v)}>
                            {products.map((product) => (
                              <DropdownMenuRadioItem
                                value={product.id}
                                className="cursor-pointer break-all"
                                key={product.id}>
                                {product?.name}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>

                          <DropdownMenuSeparator />
                          {!isViewer && (
                            <DropdownMenuItem onClick={() => setShowAddProductModal(true)}>
                              <PlusIcon className="mr-2 h-4 w-4" />
                              <span>Add product</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    {/* Team Switch */}

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div>
                          <p>{currentTeamName}</p>
                          <p className="block text-xs text-slate-500">Team</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup
                            value={currentTeamId}
                            onValueChange={(teamId) => handleEnvironmentChangeByTeam(teamId)}>
                            {teams?.map((team) => (
                              <DropdownMenuRadioItem value={team.id} className="cursor-pointer" key={team.id}>
                                {team.name}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setShowCreateTeamModal(true)}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            <span>Create team</span>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    {/* Environment Switch */}

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div>
                          <p>{capitalizeFirstLetter(environment?.type)}</p>
                          <p className=" block text-xs text-slate-500">Environment</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup
                            value={environment?.type}
                            onValueChange={(v) => handleEnvironmentChange(v as "production" | "development")}>
                            <DropdownMenuRadioItem value="production" className="cursor-pointer">
                              Production
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="development" className="cursor-pointer">
                              Development
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    {dropdownNavigation.map((item) => (
                      <DropdownMenuGroup key={item.title}>
                        <DropdownMenuSeparator />
                        {item.links.map(
                          (link) =>
                            !link.hidden && (
                              <Link href={link.href} target={link.target} key={link.label}>
                                <DropdownMenuItem key={link.label} onClick={link?.onClick}>
                                  <div className="flex items-center">
                                    <link.icon className="mr-2 h-4 w-4" />
                                    <span>{link.label}</span>
                                  </div>
                                </DropdownMenuItem>
                              </Link>
                            )
                        )}
                      </DropdownMenuGroup>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {isFormbricksCloud && (
                        <>
                          <DropdownMenuItem>
                            <a href="mailto:johannes@formbricks.com">
                              <div className="flex items-center">
                                <MailIcon className="mr-2 h-4 w-4" />
                                <span>Email us!</span>
                              </div>
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <button
                              onClick={() => {
                                formbricks.track("Top Menu: Product Feedback");
                              }}>
                              <div className="flex items-center">
                                <MessageSquareTextIcon className="mr-2 h-4 w-4" />
                                <span>Product Feedback</span>
                              </div>
                            </button>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={async () => {
                          await signOut({ callbackUrl: "/auth/login" });
                          await formbricksLogout();
                        }}>
                        <div className="flex h-full w-full items-center">
                          <LogOutIcon className="mr-2 h-4 w-4" />
                          Logout
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <AddProductModal
            open={showAddProductModal}
            setOpen={(val) => setShowAddProductModal(val)}
            environmentId={environment.id}
          />
          <CreateTeamModal open={showCreateTeamModal} setOpen={(val) => setShowCreateTeamModal(val)} />
          <UrlShortenerModal
            open={showLinkShortenerModal}
            setOpen={(val) => setShowLinkShortenerModal(val)}
            webAppUrl={webAppUrl}
          />
        </nav>
      )}
    </>
  );
}
