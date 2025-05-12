"use client";

import { NavigationLink } from "@/app/(app)/environments/[environmentId]/components/NavigationLink";
import { formbricksLogout } from "@/app/lib/formbricks";
import FBLogo from "@/images/logo.svg";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { getWhitelistedUsersAction } from "@/modules/organization/settings/whitelist/actions";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
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
} from "@/modules/ui/components/dropdown-menu";
import { useLogout } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import {
  BlocksIcon,
  // MousePointerClick,
  BookUserIcon,
  ChevronRightIcon,
  Cog,
  LogOutIcon,
  MessageCircle,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  UserCircleIcon,
  UsersIcon,
  WalletMinimalIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser, TUserWhitelistInfo } from "@formbricks/types/user";

interface NavigationProps {
  environment: TEnvironment;
  organizations: TOrganization[];
  user: TUser;
  organization: TOrganization;
  projects: TProject[];
  isMultiOrgEnabled: boolean;
  organizationProjectsLimit: number;
  hasAccess: boolean;
}

export const MainNavigation = ({
  environment,
  organizations,
  organization,
  user,
  projects,
  isMultiOrgEnabled,
  hasAccess,
}: NavigationProps) => {
  const { logout } = useLogout({});

  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslate();
  const [currentOrganizationName, setCurrentOrganizationName] = useState("");
  const [currentOrganizationId, setCurrentOrganizationId] = useState("");
  const [showCreateOrganizationModal, setShowCreateOrganizationModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [isFetchingCommunities, setIsFetchingCommunities] = useState(false);
  const [communities, setCommunities] = useState<TUserWhitelistInfo[]>([]);
  const searchParams = useSearchParams();
  const communityId = searchParams.get("community");

  const project = projects.find((project) => project.id === environment.projectId);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    localStorage.setItem("isMainNavCollapsed", isCollapsed ? "false" : "true");
  };

  // Fetching whitelisted users
  const fetchCommunities = useCallback(async () => {
    if (!currentOrganizationId) {
      return;
    }
    setIsFetchingCommunities(true);
    const data = await getWhitelistedUsersAction({
      take: 10,
      skip: 0,
      organizationId: currentOrganizationId,
    });
    if (data && data.data) {
      setCommunities(data.data);
    } else {
      setCommunities([]);
    }
    setIsFetchingCommunities(false);
  }, [currentOrganizationId]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  useEffect(() => {
    const isCollapsedValueFromLocalStorage = localStorage.getItem("isMainNavCollapsed") === "true";
    setIsCollapsed(isCollapsedValueFromLocalStorage);
  }, []);

  useEffect(() => {
    const toggleTextOpacity = () => {
      setIsTextVisible(isCollapsed ? true : false);
    };
    const timeoutId = setTimeout(toggleTextOpacity, 150);
    return () => clearTimeout(timeoutId);
  }, [isCollapsed]);

  useEffect(() => {
    if (organization && organization.name !== "") {
      setCurrentOrganizationName(organization.name);
      setCurrentOrganizationId(organization.id);
    }
  }, [organization]);

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations]);

  const handleEnvironmentChangeByOrganization = (organizationId: string) => {
    router.push(`/organizations/${organizationId}/`);
  };

  const mainNavigation = useMemo(
    () => [
      {
        name: t("common.discover"),
        href: `/environments/${environment.id}/discover`,
        icon: SearchIcon,
        isActive: pathname?.includes("/discover"),
        isHidden: false,
      },
      {
        name: t("common.surveys"),
        href: `/environments/${environment.id}/engagements`,
        icon: MessageCircle,
        isActive: pathname?.includes("/engagements"),
        isHidden: false,
      },
      {
        name: t("common.wallet"),
        href: `/environments/${environment.id}/wallet`,
        icon: WalletMinimalIcon,
        isActive: pathname?.includes("/wallet"),
        isHidden: false,
      },
      ...(hasAccess
        ? [
            // {
            //   href: `/environments/${environment.id}/contacts`,
            //   name: t("common.contacts"),
            //   icon: UserIcon,
            //   isActive: pathname?.includes("/contacts") || pathname?.includes("/segments"),
            // },
            // {
            //   name: t("common.actions"),
            //   href: `/environments/${environment.id}/actions`,
            //   icon: MousePointerClick,
            //   isActive: pathname?.includes("/actions") || pathname?.includes("/actions"),
            // },
            {
              name: t("common.integrations"),
              href: `/environments/${environment.id}/integrations`,
              icon: BlocksIcon,
              isActive: pathname?.includes("/integrations"),
            },
            {
              name: t("common.configuration"),
              href: `/environments/${environment.id}/project/general`,
              icon: Cog,
              isActive: pathname?.includes("/project"),
            },
          ]
        : []),
    ],
    [t, environment.id, pathname]
  );

  const dropdownNavigation = [
    {
      label: t("common.account"),
      href: `/environments/${environment.id}/settings/profile`,
      icon: UserCircleIcon,
    },
    ...(hasAccess
      ? [
          {
            label: t("common.organization"),
            href: `/environments/${environment.id}/settings/general`,
            icon: UsersIcon,
          },
        ]
      : []),
  ];

  const mainNavigationLink = `/environments/${environment.id}/discover`;
  
  return (
    <>
      {project && (
        <aside
          className={cn(
            "z-40 flex flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100",
            !isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded",
            environment.type === "development" ? `h-[calc(100vh-1.25rem)]` : "h-screen"
          )}>
          <div>
            {/* Logo and Toggle */}

            <div className="flex items-center justify-between px-3 pb-4">
              {!isCollapsed && (
                <Link
                  href={mainNavigationLink}
                  className={cn(
                    "flex items-center justify-center transition-opacity duration-100",
                    isTextVisible ? "opacity-0" : "opacity-100"
                  )}>
                  <Image src={FBLogo} width={160} height={30} alt={t("environments.formbricks_logo")} />
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className={cn(
                  "rounded-xl bg-slate-50 p-1 text-slate-600 transition-all hover:bg-slate-100 focus:outline-none focus:ring-0 focus:ring-transparent"
                )}>
                {isCollapsed ? (
                  <PanelLeftOpenIcon strokeWidth={1.5} />
                ) : (
                  <PanelLeftCloseIcon strokeWidth={1.5} />
                )}
              </Button>
            </div>

            <ul>
              {mainNavigation.map(
                (item) =>
                  !item.isHidden && (
                    <NavigationLink
                      key={item.name}
                      href={item.href}
                      isActive={item.isActive}
                      isCollapsed={isCollapsed}
                      isTextVisible={isTextVisible}
                      linkText={item.name}>
                      <item.icon strokeWidth={1.5} />
                    </NavigationLink>
                  )
              )}
            </ul>

            {/* Communities */}
            <div className="flex w-full flex-1 flex-col items-start py-4">
              <div className={`px-4 ${isCollapsed && "hidden"}`}>Communities</div>
              {isFetchingCommunities ? (
                <>
                  <ul className="max-h-[200px] w-full flex-1">
                    {[...Array(3)].map((_, index) => {
                      return (
                        <NavigationLink
                          key={"loading-" + index}
                          href={`/environments/${environment.id}/discover`}
                          linkText={"Loading"}
                          isActive={false}
                          loading={true}
                          isCollapsed={isCollapsed}
                          isTextVisible={isTextVisible}>
                          <BookUserIcon className="" strokeWidth={1.5} />
                        </NavigationLink>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <ul className="max-h-[200px] w-full flex-1 overflow-y-scroll">
                  {communities && communities.length > 0 ? (
                    communities.map((community) => {
                      return (
                        <NavigationLink
                          key={community.id}
                          href={`/environments/${environment.id}/discover`}
                          query={{ community: community.id }}
                          linkText={community.name ? community.name : community.email}
                          isActive={community.id == communityId}
                          isCollapsed={isCollapsed}
                          isTextVisible={isTextVisible}>
                          <BookUserIcon className="" strokeWidth={1.5} />
                        </NavigationLink>
                      );
                    })
                  ) : (
                    <li className="mb-1 ml-2 rounded-l-md py-2 pl-2 text-sm text-slate-700">
                      No Communities
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div>
            {/* User Switch */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  id="userDropdownTrigger"
                  className="w-full rounded-br-xl border-t py-4 transition-colors duration-200 hover:bg-slate-50 focus:outline-none">
                  <div
                    tabIndex={0}
                    className={cn(
                      "flex cursor-pointer flex-row items-center space-x-3",
                      isCollapsed ? "pl-2" : "pl-4"
                    )}>
                    <ProfileAvatar userId={user.id} imageUrl={user.imageUrl} />
                    {!isCollapsed && !isTextVisible && (
                      <>
                        <div className={cn(isTextVisible ? "opacity-0" : "opacity-100")}>
                          <p
                            title={user?.email}
                            className={cn(
                              "ph-no-capture ph-no-capture -mb-0.5 max-w-28 truncate text-sm font-bold text-slate-700"
                            )}>
                            {user?.name ? <span>{user?.name}</span> : <span>{user?.email}</span>}
                          </p>
                          <p
                            title={capitalizeFirstLetter(organization?.name)}
                            className="max-w-28 truncate text-sm text-slate-500">
                            {capitalizeFirstLetter(organization?.name)}
                          </p>
                        </div>
                        <ChevronRightIcon className={cn("h-5 w-5 text-slate-700 hover:text-slate-500")} />
                      </>
                    )}
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  id="userDropdownInnerContentWrapper"
                  side="right"
                  sideOffset={10}
                  alignOffset={5}
                  align="end">
                  {/* Dropdown Items */}

                  {dropdownNavigation.map((link) => (
                    <Link href={link.href} className="flex w-full items-center" key={link.label}>
                      <DropdownMenuItem>
                        <link.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        {link.label}
                      </DropdownMenuItem>
                    </Link>
                  ))}

                  {/* Logout */}

                  <DropdownMenuItem
                    onClick={async () => {
                      await logout();
                      const route = await signOut({ redirect: false, callbackUrl: "/auth/login" });
                      router.push(route.url);
                      await formbricksLogout();
                    }}
                    icon={<LogOutIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />}>
                    {t("common.logout")}
                  </DropdownMenuItem>

                  {/* Organization Switch */}

                  {(isMultiOrgEnabled || organizations.length > 1) && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="rounded-lg">
                        <div>
                          <p>{currentOrganizationName}</p>
                          <p className="block text-xs text-slate-500">{t("common.switch_organization")}</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent sideOffset={10} alignOffset={5}>
                          <DropdownMenuRadioGroup
                            value={currentOrganizationId}
                            onValueChange={(organizationId) =>
                              handleEnvironmentChangeByOrganization(organizationId)
                            }>
                            {sortedOrganizations.map((organization) => (
                              <DropdownMenuRadioItem
                                value={organization.id}
                                className="cursor-pointer rounded-lg"
                                key={organization.id}>
                                {organization.name}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                          <DropdownMenuSeparator />
                          {isMultiOrgEnabled && (
                            <DropdownMenuItem
                              onClick={() => setShowCreateOrganizationModal(true)}
                              icon={<PlusIcon className="mr-2 h-4 w-4" />}>
                              <span>{t("common.create_new_organization")}</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
      )}
      <CreateOrganizationModal
        open={showCreateOrganizationModal}
        setOpen={(val) => setShowCreateOrganizationModal(val)}
      />
    </>
  );
};
