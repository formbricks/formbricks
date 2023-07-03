"use client";

import FaveIcon from "@/app/favicon.ico";
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
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import CreateTeamModal from "@/components/team/CreateTeamModal";
import {
  changeEnvironment,
  changeEnvironmentByProduct,
  changeEnvironmentByTeam,
} from "@/lib/environments/changeEnvironments";
import { useEnvironment } from "@/lib/environments/environments";
import { useMemberships } from "@/lib/memberships";
import { useTeam } from "@/lib/teams/teams";
import { capitalizeFirstLetter, truncate } from "@/lib/utils";
import {
  CustomersIcon,
  ErrorComponent,
  FilterIcon,
  FormIcon,
  ProfileAvatar,
  SettingsIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formbricks/ui";
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
  UserCircleIcon,
  UsersIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AddProductModal from "./AddProductModal";
import { formbricksLogout } from "@/lib/formbricks";
import formbricks from "@formbricks/js";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

interface EnvironmentsNavbarProps {
  environmentId: string;
  session: Session;
}

export default function EnvironmentsNavbar({ environmentId, session }: EnvironmentsNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { environment, isErrorEnvironment, isLoadingEnvironment } = useEnvironment(environmentId);
  const { memberships, isErrorMemberships, isLoadingMemberships } = useMemberships();
  const { team } = useTeam(environmentId);

  const [currentTeamName, setCurrentTeamName] = useState("");
  const [currentTeamId, setCurrentTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

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
        name: "Actions & Attributes",
        href: `/environments/${environmentId}/events`,
        icon: FilterIcon,
        current: pathname?.includes("/events") || pathname?.includes("/attributes"),
      },
      /*       {
        name: "Integrations",
        href: `/environments/${environmentId}/integrations/installation`,
        icon: DashboardIcon,
        current: pathname?.includes("/integrations"),
      }, */
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
          label: "Product Settings",
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
        },
        { icon: UsersIcon, label: "Team", href: `/environments/${environmentId}/settings/members` },
        {
          icon: CreditCardIcon,
          label: "Billing & Plan",
          href: `/environments/${environmentId}/settings/billing`,
          hidden: IS_FORMBRICKS_CLOUD,
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
          hidden: widgetSetupCompleted,
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
          href: "https://github.com/formbricks/formbricks",
          target: "_blank",
        },
      ],
    },
  ];

  const handleEnvironmentChange = (environmentType: "production" | "development") => {
    changeEnvironment(environmentType, environment, router);
  };

  const handleEnvironmentChangeByProduct = (productId: string) => {
    changeEnvironmentByProduct(productId, environment, router);
  };

  const handleEnvironmentChangeByTeam = (teamId: string) => {
    changeEnvironmentByTeam(teamId, memberships, router);
  };

  if (isLoadingEnvironment || loading || isLoadingMemberships) {
    return <LoadingSpinner />;
  }

  if (isErrorEnvironment || isErrorMemberships || !environment || !memberships) {
    return <ErrorComponent />;
  }

  if (pathname?.includes("/edit")) return null;

  return (
    <nav className="top-0 z-10 w-full border-b border-slate-200 bg-white">
      {environment?.type === "development" && (
        <div className="h-6 w-full bg-[#A33700] p-0.5 text-center text-sm text-white">
          You&apos;re in development mode. Use it to test surveys, events and attributes.
        </div>
      )}

      <div className="w-full px-4 sm:px-6">
        <div className="flex h-14 justify-between">
          <div className="flex  space-x-4 py-2">
            <Link
              href={`/environments/${environmentId}/surveys/`}
              className=" flex items-center justify-center rounded-md bg-gradient-to-b text-white transition-all ease-in-out hover:scale-105">
              {/* <PlusIcon className="h-6 w-6" /> */}
              <Image src={FaveIcon} width={30} height={30} alt="faveicon" />
            </Link>
            {navigation.map((item) => {
              const IconComponent: React.ElementType = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    item.current
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-900 hover:bg-slate-50 hover:text-slate-900",
                    "inline-flex items-center rounded-md px-2 py-1 text-sm font-medium"
                  )}
                  aria-current={item.current ? "page" : undefined}>
                  <IconComponent className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
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
                      className="ph-no-capture h-9 w-9 rounded-full"
                      alt="Profile picture"
                    />
                  ) : (
                    <ProfileAvatar userId={session.user.id} />
                  )}

                  <div>
                    <p className="ph-no-capture ph-no-capture -mb-0.5 text-sm font-bold text-slate-700">
                      {truncate(environment?.product?.name, 30)}
                    </p>
                    <p className="text-sm text-slate-500">{capitalizeFirstLetter(team?.name)}</p>
                  </div>
                  <ChevronDownIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel className="cursor-default break-all">
                  <span className="ph-no-capture font-normal">Signed in as </span>
                  {session?.user?.name.length > 30 ? (
                    <TooltipProvider>
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
                        <p className="">{truncate(environment?.product?.name, 20)}</p>
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
                        value={environment?.product.id}
                        onValueChange={(v) => handleEnvironmentChangeByProduct(v)}>
                        {environment?.availableProducts?.map((product) => (
                          <DropdownMenuRadioItem
                            value={product.id}
                            className="cursor-pointer break-all"
                            key={product.id}>
                            {product?.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowAddProductModal(true)}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        <span>Add product</span>
                      </DropdownMenuItem>
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
                        {memberships?.map((membership) => (
                          <DropdownMenuRadioItem
                            value={membership.teamId}
                            className="cursor-pointer"
                            key={membership.teamId}>
                            {membership?.team?.name}
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

                {dropdownnavigation.map((item) => (
                  <DropdownMenuGroup key={item.title}>
                    <DropdownMenuSeparator />
                    {item.links.map(
                      (link) =>
                        !link.hidden && (
                          <Link href={link.href} target={link.target} key={link.label}>
                            <DropdownMenuItem key={link.label}>
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
                  {IS_FORMBRICKS_CLOUD && (
                    <DropdownMenuItem>
                      <button
                        onClick={() => {
                          formbricks.track("Top Menu: Product Feedback");
                        }}>
                        <div className="flex items-center">
                          <ChatBubbleBottomCenterTextIcon className="mr-2 h-4 w-4" />
                          <span>Product Feedback</span>
                        </div>
                      </button>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={async () => {
                      setLoading(true);
                      await signOut();
                      await formbricksLogout();
                    }}>
                    <div className="flex h-full w-full items-center">
                      <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
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
        environmentId={environmentId}
      />
      <CreateTeamModal open={showCreateTeamModal} setOpen={(val) => setShowCreateTeamModal(val)} />
    </nav>
  );
}
