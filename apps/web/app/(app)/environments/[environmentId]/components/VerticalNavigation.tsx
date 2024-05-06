"use client";

import NavigationLink from "@/app/(app)/environments/[environmentId]/components/NavigationLink";

/*import { Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui/Popover"; */
import { formbricksLogout } from "@/app/lib/formbricks";
import {
  BlocksIcon,
  ChevronRightIcon,
  Cog,
  MessageCircle,
  MousePointerClick,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

import AddProductModal from "./AddProductModal";

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
  isMultiLanguageAllowed: boolean;
  isCollapsed: boolean;
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
  isMultiLanguageAllowed,
  isCollapsed = false,
}: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentTeamName, setCurrentTeamName] = useState("");
  const [currentTeamId, setCurrentTeamId] = useState("");
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const product = products.find((product) => product.id === environment.productId);
  const [mobileNavMenuOpen, setMobileNavMenuOpen] = useState(false);
  const { isAdmin, isOwner, isViewer } = getAccessFlags(membershipRole);
  const isPricingDisabled = !isOwner && !isAdmin;

  useEffect(() => {
    if (team && team.name !== "") {
      setCurrentTeamName(team.name);
      setCurrentTeamId(team.id);
    }
  }, [team]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [teams]);

  const navigationItems = useMemo(
    () => [
      {
        name: "Surveys",
        href: `/environments/${environment.id}/surveys`,
        icon: MessageCircle,
        isActive: pathname?.includes("/surveys"),
        isHidden: false,
      },
      {
        name: "Respondents",
        href: `/environments/${environment.id}/people`,
        icon: UsersIcon,
        isActive:
          pathname?.includes("/people") ||
          pathname?.includes("/segments") ||
          pathname?.includes("/attributes"),
      },
      {
        name: "Actions",
        href: `/environments/${environment.id}/actions`,
        icon: MousePointerClick,
        isActive: pathname?.includes("/actions") || pathname?.includes("/actions"),
        isHidden: false,
      },
      {
        name: "Integrations",
        href: `/environments/${environment.id}/integrations`,
        icon: BlocksIcon,
        isActive: pathname?.includes("/integrations"),
        isHidden: isViewer,
      },
      {
        name: "Configuration",
        href: `/environments/${environment.id}/product/general`,
        icon: Cog,
        isActive: pathname?.includes("/product"),
        isHidden: false,
      },
    ],
    [environment.id, pathname, isViewer]
  );

  const navItems = [
    {
      label: "Billing",
      href: `/environments/${environment.id}/settings/billing`,
      hidden: !isFormbricksCloud || isPricingDisabled,
    },
    {
      label: "Documentation",
      href: "https://formbricks.com/docs",
      target: "_blank",
    },
    {
      label: "Team Settings",
      href: `/environments/${environment.id}/settings/members`,
      target: "_blank",
    },
  ];

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

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
        <aside
          className={cn(
            "fixed inset-x-0 bottom-14 top-14 flex flex-col justify-between rounded-r-xl border border-slate-200 bg-white pt-4 shadow-sm",
            !isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"
          )}>
          <ul>
            {navigationItems.map(
              (item) =>
                !item.isHidden && (
                  <NavigationLink
                    key={item.name}
                    href={item.href}
                    isActive={item.isActive}
                    isCollapsed={isCollapsed}>
                    <item.icon className={cn("h-5 w-5", !isCollapsed ? "mr-3" : "w-sidebar-expanded")} />
                    {!isCollapsed && item.name}
                  </NavigationLink>
                )
            )}
          </ul>

          {/* User Dropdown */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                id="userDropdownTrigger"
                className="w-full rounded-br-xl border-t py-4 transition-colors duration-200 hover:bg-slate-50">
                <div tabIndex={0} className="flex cursor-pointer flex-row items-center space-x-5 pl-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 font-bold text-slate-50">
                    XM
                  </div>

                  <div>
                    <p className="ph-no-capture ph-no-capture -mb-0.5 text-sm font-bold text-slate-700">
                      {product.name}
                    </p>
                    <p className="text-sm text-slate-500">Product</p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 space-y-1 rounded-xl border border-slate-200 shadow-sm"
                id="userDropdownInnerContentWrapper"
                side="right"
                sideOffset={10}
                alignOffset={-1}
                align="end">
                <DropdownMenuRadioGroup
                  value={product!.id}
                  onValueChange={(v) => handleEnvironmentChangeByProduct(v)}>
                  {sortedProducts.map((product) => (
                    <DropdownMenuRadioItem
                      value={product.id}
                      className="cursor-pointer break-all rounded-lg"
                      key={product.id}>
                      {product?.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                {!isViewer && (
                  <DropdownMenuItem onClick={() => setShowAddProductModal(true)} className="rounded-lg">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    <span>Add product</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden lg:flex lg:items-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  id="userDropdownTrigger"
                  className="w-full rounded-br-xl border-t py-4 transition-colors duration-200 hover:bg-slate-50">
                  <div tabIndex={0} className="flex cursor-pointer flex-row items-center space-x-5 pl-4">
                    <ProfileAvatar userId={session.user.id} imageUrl={session.user.imageUrl} />

                    <div>
                      <p className="ph-no-capture ph-no-capture -mb-0.5 text-sm font-bold text-slate-700">
                        {session?.user?.name ? (
                          <span>{truncate(session?.user?.name, 30)}</span>
                        ) : (
                          <span>{truncate(session?.user?.email, 30)}</span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500">{capitalizeFirstLetter(team?.name)}</p>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-56 space-y-1 rounded-xl border border-slate-200 shadow-sm"
                  id="userDropdownInnerContentWrapper"
                  side="right"
                  sideOffset={10}
                  alignOffset={-1}
                  align="end">
                  <DropdownMenuItem className=" break-all rounded-lg text-xs font-normal">
                    <Link href={`/environments/${environment.id}/settings/profile`}>
                      {session?.user?.email.length > 30 ? (
                        <TooltipProvider delayDuration={50}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="">{truncate(session?.user?.email, 30)}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[45rem] break-all" side="left" sideOffset={5}>
                              {session?.user?.email}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="">{session?.user?.email}</span>
                      )}
                    </Link>
                  </DropdownMenuItem>

                  {/* Logout */}

                  <DropdownMenuItem
                    className="rounded-lg font-normal"
                    onClick={async () => {
                      await signOut({ callbackUrl: "/auth/login" });
                      await formbricksLogout();
                    }}>
                    Logout
                  </DropdownMenuItem>

                  {/* Dropdown Items */}

                  {navItems.map(
                    (link) =>
                      !link.hidden && (
                        <Link href={link.href} target={link.target} key={link.label}>
                          <DropdownMenuItem className="rounded-lg font-normal" key={link.label}>
                            {link.label}
                          </DropdownMenuItem>
                        </Link>
                      )
                  )}

                  {/* Team Switch */}

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="rounded-lg">
                      <div>
                        <p>{currentTeamName}</p>
                        <p className="block text-xs text-slate-500">Switch team</p>
                      </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent
                        className="rounded-xl border border-slate-200 shadow-sm"
                        sideOffset={10}>
                        <DropdownMenuRadioGroup
                          value={currentTeamId}
                          onValueChange={(teamId) => handleEnvironmentChangeByTeam(teamId)}>
                          {sortedTeams.map((team) => (
                            <DropdownMenuRadioItem
                              value={team.id}
                              className="cursor-pointer rounded-lg"
                              key={team.id}>
                              {team.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowCreateTeamModal(true)} className="rounded-lg">
                          <PlusIcon className="mr-2 h-4 w-4" />
                          <span>Create new team</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
      )}
      <CreateTeamModal open={showCreateTeamModal} setOpen={(val) => setShowCreateTeamModal(val)} />
      <AddProductModal
        open={showAddProductModal}
        setOpen={(val) => setShowAddProductModal(val)}
        environmentId={environment.id}
      />
    </>
  );
}
