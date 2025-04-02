"use client";

import { NavigationLink } from "@/app/(app)/environments/[environmentId]/components/NavigationLink";
import { formbricksLogout } from "@/app/lib/formbricks";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { ProjectSwitcher } from "@/modules/projects/components/project-switcher";
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
import { useTranslate } from "@tolgee/react";
import {
  ArrowUpRightIcon,
  BlocksIcon,
  ChevronRightIcon,
  Cog,
  LogOutIcon,
  MessageCircle,
  MousePointerClick,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  UserCircleIcon,
  UserIcon,
  UsersIcon,
  WalletMinimalIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";

interface NavigationProps {
  environment: TEnvironment;
  organizations: TOrganization[];
  user: TUser;
  organization: TOrganization;
  projects: TProject[];
  isMultiOrgEnabled: boolean;
  membershipRole?: TOrganizationRole;
  organizationProjectsLimit: number;
  isLicenseActive: boolean;
}

export const MainNavigation = ({
  environment,
  organizations,
  organization,
  user,
  projects,
  isMultiOrgEnabled,
  membershipRole,
  organizationProjectsLimit,
  isLicenseActive,
}: NavigationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslate();
  const [currentOrganizationName, setCurrentOrganizationName] = useState("");
  const [currentOrganizationId, setCurrentOrganizationId] = useState("");
  const [showCreateOrganizationModal, setShowCreateOrganizationModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isTextVisible, setIsTextVisible] = useState(true);

  const project = projects.find((project) => project.id === environment.projectId);
  const { isManager, isOwner, isBilling } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isManager || isOwner;

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    localStorage.setItem("isMainNavCollapsed", isCollapsed ? "false" : "true");
  };

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

  const sortedProjects = useMemo(() => {
    const channelOrder: (string | null)[] = ["website", "app", "link", null];

    const groupedProjects = projects.reduce(
      (acc, project) => {
        const channel = project.config.channel;
        const key = channel !== null ? channel : "null";
        acc[key] = acc[key] || [];
        acc[key].push(project);
        return acc;
      },
      {} as Record<string, typeof projects>
    );

    Object.keys(groupedProjects).forEach((channel) => {
      groupedProjects[channel].sort((a, b) => a.name.localeCompare(b.name));
    });

    return channelOrder.flatMap((channel) => groupedProjects[channel !== null ? channel : "null"] || []);
  }, [projects]);

  const handleEnvironmentChangeByOrganization = (organizationId: string) => {
    router.push(`/organizations/${organizationId}/`);
  };

  const mainNavigation = useMemo(
    () => [
      {
        name: t("common.surveys"),
        href: `/environments/${environment.id}/surveys`,
        icon: MessageCircle,
        isActive: pathname?.includes("/surveys"),
        isHidden: false,
      },
      {
        href: `/environments/${environment.id}/contacts`,
        name: t("common.contacts"),
        icon: UserIcon,
        isActive: pathname?.includes("/contacts") || pathname?.includes("/segments"),
      },
      {
        name: t("common.actions"),
        href: `/environments/${environment.id}/actions`,
        icon: MousePointerClick,
        isActive: pathname?.includes("/actions") || pathname?.includes("/actions"),
      },
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
      {
        name: t("common.wallet"),
        href: `/environments/${environment.id}/wallet`,
        icon: WalletMinimalIcon,
        isActive: pathname?.includes("/wallet"),
        isHidden: false,
      }
    ],
    [t, environment.id, pathname]
  );

  const dropdownNavigation = [
    {
      label: t("common.account"),
      href: `/environments/${environment.id}/settings/profile`,
      icon: UserCircleIcon,
    },
    {
      label: t("common.organization"),
      href: `/environments/${environment.id}/settings/general`,
      icon: UsersIcon,
    },
    {
      label: t("common.documentation"),
      href: "https://formbricks.com/docs",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
  ];

  const mainNavigationLink = `/environments/${environment.id}/${isBilling ? "settings/billing/" : "surveys/"}`;

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

            {/* Main Nav Switch */}
            {!isBilling && (
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
            )}
          </div>

          <div>
            {/* Project Switch */}
            {!isBilling && (
              <ProjectSwitcher
                environmentId={environment.id}
                projects={sortedProjects}
                project={project}
                isCollapsed={isCollapsed}
                isLicenseActive={isLicenseActive}
                isOwnerOrManager={isOwnerOrManager}
                isTextVisible={isTextVisible}
                organization={organization}
                organizationProjectsLimit={organizationProjectsLimit}
              />
            )}

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
                    <Link
                      href={link.href}
                      target={link.target}
                      className="flex w-full items-center"
                      key={link.label}>
                      <DropdownMenuItem>
                        <link.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        {link.label}
                      </DropdownMenuItem>
                    </Link>
                  ))}

                  {/* Logout */}

                  <DropdownMenuItem
                    onClick={async () => {
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