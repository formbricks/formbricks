"use client";

import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  Cog,
  LogOutIcon,
  MessageCircle,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RocketIcon,
  UserCircleIcon,
  UserIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { NavigationLink } from "@/app/(app)/environments/[environmentId]/components/NavigationLink";
import { isNewerVersion } from "@/app/(app)/environments/[environmentId]/lib/utils";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { getAccessFlags } from "@/lib/membership/utils";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { getLatestStableFbReleaseAction } from "@/modules/projects/settings/(setup)/app-connection/actions";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import packageJson from "../../../../../package.json";

interface NavigationProps {
  environment: TEnvironment;
  user: TUser;
  organization: TOrganization;
  project: { id: string; name: string };
  isFormbricksCloud: boolean;
  isDevelopment: boolean;
  membershipRole?: TOrganizationRole;
}

export const MainNavigation = ({
  environment,
  organization,
  user,
  project,
  membershipRole,
  isFormbricksCloud,
  isDevelopment,
}: NavigationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [latestVersion, setLatestVersion] = useState("");
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });

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
      setIsTextVisible(isCollapsed);
    };
    const timeoutId = setTimeout(toggleTextOpacity, 150);
    return () => clearTimeout(timeoutId);
  }, [isCollapsed]);

  useEffect(() => {
    // Auto collapse project navbar on org and account settings
    if (pathname?.includes("/settings")) {
      setIsCollapsed(true);
    }
  }, [pathname]);

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
        name: t("common.configuration"),
        href: `/environments/${environment.id}/project/general`,
        icon: Cog,
        isActive: pathname?.includes("/project"),
      },
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
      label: t("common.documentation"),
      href: "https://formbricks.com/docs",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
    {
      label: t("common.share_feedback"),
      href: "https://github.com/formbricks/formbricks/issues",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
  ];

  useEffect(() => {
    async function loadReleases() {
      const res = await getLatestStableFbReleaseAction();
      if (res?.data) {
        const latestVersionTag = res.data;
        const currentVersionTag = `v${packageJson.version}`;

        if (isNewerVersion(currentVersionTag, latestVersionTag)) {
          setLatestVersion(latestVersionTag);
        }
      }
    }
    if (isOwnerOrManager) loadReleases();
  }, [isOwnerOrManager]);

  const mainNavigationLink = `/environments/${environment.id}/${isBilling ? "settings/billing/" : "surveys/"}`;

  return (
    <>
      {project && (
        <aside
          className={cn(
            "z-40 flex flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100",
            !isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"
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
            {/* New Version Available */}
            {!isCollapsed && isOwnerOrManager && latestVersion && !isFormbricksCloud && !isDevelopment && (
              <Link
                href="https://github.com/formbricks/formbricks/releases"
                target="_blank"
                className="m-2 flex items-center space-x-4 rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-200">
                <p className="flex items-center justify-center gap-x-2 text-xs">
                  <RocketIcon strokeWidth={1.5} className="mx-1 h-6 w-6 text-slate-900" />
                  {t("common.new_version_available", { version: latestVersion })}
                </p>
              </Link>
            )}

            {/* User Switch */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  id="userDropdownTrigger"
                  className="w-full rounded-br-xl border-t py-4 transition-colors duration-200 hover:bg-slate-50 focus:outline-none">
                  <div
                    className={cn(
                      "flex cursor-pointer flex-row items-center gap-3",
                      isCollapsed ? "justify-center px-2" : "px-4"
                    )}>
                    <ProfileAvatar userId={user.id} />
                    {!isCollapsed && !isTextVisible && (
                      <>
                        <div
                          className={cn(isTextVisible ? "opacity-0" : "opacity-100", "grow overflow-hidden")}>
                          <p
                            title={user?.email}
                            className={cn(
                              "ph-no-capture ph-no-capture -mb-0.5 truncate text-sm font-bold text-slate-700"
                            )}>
                            {user?.name ? <span>{user?.name}</span> : <span>{user?.email}</span>}
                          </p>
                          <p className="text-sm text-slate-700">{t("common.account")}</p>
                        </div>
                        <ChevronRightIcon
                          className={cn("h-5 w-5 shrink-0 text-slate-700 hover:text-slate-500")}
                        />
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
                      key={link.label}
                      rel={link.target === "_blank" ? "noopener noreferrer" : undefined}>
                      <DropdownMenuItem>
                        <link.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        {link.label}
                      </DropdownMenuItem>
                    </Link>
                  ))}
                  {/* Logout */}
                  <DropdownMenuItem
                    onClick={async () => {
                      const route = await signOutWithAudit({
                        reason: "user_initiated",
                        redirectUrl: "/auth/login",
                        organizationId: organization.id,
                        redirect: false,
                        callbackUrl: "/auth/login",
                        clearEnvironmentId: true,
                      });
                      router.push(route?.url || "/auth/login"); // NOSONAR // We want to check for empty strings
                    }}
                    icon={<LogOutIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />}>
                    {t("common.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};
