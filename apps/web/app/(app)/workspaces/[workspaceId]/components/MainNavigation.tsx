"use client";

import {
  ArrowUpRightIcon,
  Building2Icon,
  ChevronRightIcon,
  Cog,
  FoldersIcon,
  Loader2,
  LogOutIcon,
  MessageCircle,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  UserCircleIcon,
  UserIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import {
  getOrganizationsForSwitcherAction,
  getWorkspacesForSwitcherAction,
} from "@/app/(app)/workspaces/[workspaceId]/actions";
import { NavigationLink } from "@/app/(app)/workspaces/[workspaceId]/components/NavigationLink";
import { isNewerVersion } from "@/app/(app)/workspaces/[workspaceId]/lib/utils";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { TrialAlert } from "@/modules/ee/billing/components/trial-alert";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { ModalButton } from "@/modules/ui/components/upgrade-prompt";
import { CreateWorkspaceModal } from "@/modules/workspaces/components/create-workspace-modal";
import { WorkspaceLimitModal } from "@/modules/workspaces/components/workspace-limit-modal";
import { getLatestStableFbReleaseAction } from "@/modules/workspaces/settings/(setup)/app-connection/actions";
import packageJson from "../../../../../package.json";

interface NavigationProps {
  user: TUser;
  organization: TOrganization;
  workspace: { id: string; name: string };
  isFormbricksCloud: boolean;
  isDevelopment: boolean;
  membershipRole?: TOrganizationRole;
  publicDomain: string;
  isMultiOrgEnabled: boolean;
  organizationWorkspacesLimit: number;
  isLicenseActive: boolean;
  isAccessControlAllowed: boolean;
}

const isActiveWorkspaceSetting = (pathname: string, settingId: string): boolean => {
  if (pathname.includes("/settings/")) {
    return false;
  }

  const pattern = new RegExp(`/workspace/${settingId}(?:/|$)`);
  return pattern.test(pathname);
};

const isActiveOrganizationSetting = (pathname: string, settingId: string): boolean => {
  const accountSettingsPattern = /\/settings\/(profile|account|notifications|security|appearance)(?:\/|$)/;
  if (accountSettingsPattern.test(pathname)) {
    return false;
  }

  const pattern = new RegExp(`/settings/${settingId}(?:/|$)`);
  return pattern.test(pathname);
};

export const MainNavigation = ({
  organization,
  user,
  workspace,
  membershipRole,
  isFormbricksCloud,
  isDevelopment,
  publicDomain,
  isMultiOrgEnabled,
  organizationWorkspacesLimit,
  isLicenseActive,
  isAccessControlAllowed,
}: NavigationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [latestVersion, setLatestVersion] = useState("");
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });

  const [isPending, startTransition] = useTransition();
  const { isManager, isOwner, isBilling, isMember } = getAccessFlags(membershipRole);

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
    // Auto collapse workspace navbar on org and account settings
    if (pathname?.includes("/settings")) {
      setIsCollapsed(true);
    }
  }, [pathname]);

  const mainNavigation = useMemo(
    () => [
      {
        name: t("common.surveys"),
        href: `/workspaces/${workspace.id}/surveys`,
        icon: MessageCircle,
        isActive: pathname?.includes("/surveys"),
        isHidden: false,
      },
      {
        href: `/workspaces/${workspace.id}/contacts`,
        name: t("common.contacts"),
        icon: UserIcon,
        isActive:
          pathname?.includes("/contacts") ||
          pathname?.includes("/segments") ||
          pathname?.includes("/attributes"),
      },
      {
        name: t("common.configuration"),
        href: `/workspaces/${workspace.id}/general`,
        icon: Cog,
        isActive:
          pathname?.includes("/general") ||
          pathname?.includes("/look") ||
          pathname?.includes("/app-connection") ||
          pathname?.includes("/integrations") ||
          pathname?.includes("/teams") ||
          pathname?.includes("/languages") ||
          pathname?.includes("/tags"),
      },
    ],
    [t, workspace.id, pathname]
  );

  const dropdownNavigation = [
    {
      label: t("common.account"),
      href: `/workspaces/${workspace.id}/settings/profile`,
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

  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [hasInitializedWorkspaces, setHasInitializedWorkspaces] = useState(false);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [organizationLoadError, setOrganizationLoadError] = useState<string | null>(null);
  const [openCreateWorkspaceModal, setOpenCreateWorkspaceModal] = useState(false);
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState(false);
  const [openWorkspaceLimitModal, setOpenWorkspaceLimitModal] = useState(false);

  const renderSwitcherError = (error: string, onRetry: () => void, retryLabel: string) => (
    <div className="px-2 py-4">
      <p className="mb-2 text-sm text-red-600">{error}</p>
      <button onClick={onRetry} className="text-xs text-slate-600 underline hover:text-slate-800">
        {retryLabel}
      </button>
    </div>
  );

  const workspaceSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `/workspaces/${workspace.id}/general`,
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      href: `/workspaces/${workspace.id}/look`,
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      href: `/workspaces/${workspace.id}/app-connection`,
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      href: `/workspaces/${workspace.id}/integrations`,
    },
    {
      id: "teams",
      label: t("common.team_access"),
      href: `/workspaces/${workspace.id}/teams`,
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      href: `/workspaces/${workspace.id}/languages`,
    },
    {
      id: "tags",
      label: t("common.tags"),
      href: `/workspaces/${workspace.id}/tags`,
    },
  ];

  const organizationSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `/workspaces/${workspace.id}/settings/general`,
    },
    {
      id: "teams",
      label: t("common.members_and_teams"),
      href: `/workspaces/${workspace.id}/settings/teams`,
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `/workspaces/${workspace.id}/settings/api-keys`,
      hidden: !isOwnerOrManager,
    },
    {
      id: "domain",
      label: t("common.domain"),
      href: `/workspaces/${workspace.id}/settings/domain`,
      hidden: isFormbricksCloud,
    },
    {
      id: "billing",
      label: t("common.billing"),
      href: `/workspaces/${workspace.id}/settings/billing`,
      hidden: !isFormbricksCloud,
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `/workspaces/${workspace.id}/settings/enterprise`,
      hidden: isFormbricksCloud || isMember,
    },
  ];

  const loadWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    setWorkspaceLoadError(null);

    try {
      const result = await getWorkspacesForSwitcherAction({ organizationId: organization.id });
      if (result?.data) {
        const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
        setWorkspaces(sorted);
      } else {
        setWorkspaceLoadError(getFormattedErrorMessage(result) || t("common.failed_to_load_workspaces"));
      }
    } catch (error) {
      const formattedError =
        typeof error === "object" && error !== null
          ? getFormattedErrorMessage(error as { serverError?: string; validationErrors?: unknown })
          : "";
      setWorkspaceLoadError(
        formattedError || (error instanceof Error ? error.message : t("common.failed_to_load_workspaces"))
      );
    } finally {
      setIsLoadingWorkspaces(false);
      setHasInitializedWorkspaces(true);
    }
  }, [organization.id, t]);

  useEffect(() => {
    if (!isWorkspaceDropdownOpen || workspaces.length > 0 || isLoadingWorkspaces || workspaceLoadError) {
      return;
    }

    loadWorkspaces();
  }, [isWorkspaceDropdownOpen, workspaces.length, isLoadingWorkspaces, workspaceLoadError, loadWorkspaces]);

  const loadOrganizations = useCallback(async () => {
    setIsLoadingOrganizations(true);
    setOrganizationLoadError(null);

    try {
      const result = await getOrganizationsForSwitcherAction({ organizationId: organization.id });
      if (result?.data) {
        const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
        setOrganizations(sorted);
      } else {
        setOrganizationLoadError(
          getFormattedErrorMessage(result) || t("common.failed_to_load_organizations")
        );
      }
    } catch (error) {
      const formattedError =
        typeof error === "object" && error !== null
          ? getFormattedErrorMessage(error as { serverError?: string; validationErrors?: unknown })
          : "";
      setOrganizationLoadError(
        formattedError || (error instanceof Error ? error.message : t("common.failed_to_load_organizations"))
      );
    } finally {
      setIsLoadingOrganizations(false);
    }
  }, [organization.id, t]);

  useEffect(() => {
    if (
      !isOrganizationDropdownOpen ||
      organizations.length > 0 ||
      isLoadingOrganizations ||
      organizationLoadError
    ) {
      return;
    }

    loadOrganizations();
  }, [
    isOrganizationDropdownOpen,
    organizations.length,
    isLoadingOrganizations,
    organizationLoadError,
    loadOrganizations,
  ]);

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

  const trialDaysRemaining = useMemo(() => {
    if (!isFormbricksCloud || organization.billing?.stripe?.subscriptionStatus !== "trialing") return null;
    const trialEnd = organization.billing.stripe.trialEnd;
    if (!trialEnd) return null;
    const ts = new Date(trialEnd).getTime();
    if (!Number.isFinite(ts)) return null;
    const msPerDay = 86_400_000;
    return Math.ceil((ts - Date.now()) / msPerDay);
  }, [
    isFormbricksCloud,
    organization.billing?.stripe?.subscriptionStatus,
    organization.billing?.stripe?.trialEnd,
  ]);

  const mainNavigationLink = `/workspaces/${workspace.id}/${isBilling ? "settings/billing/" : "surveys/"}`;

  const handleWorkspaceChange = (workspaceId: string) => {
    if (workspaceId === workspace.id) return;
    startTransition(() => {
      router.push(`/workspaces/${workspaceId}/`);
    });
  };

  const handleOrganizationChange = (organizationId: string) => {
    if (organizationId === organization.id) return;
    startTransition(() => {
      router.push(`/organizations/${organizationId}/`);
    });
  };

  const handleSettingNavigation = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  const handleWorkspaceCreate = () => {
    if (!hasInitializedWorkspaces || isLoadingWorkspaces) {
      return;
    }

    if (workspaces.length >= organizationWorkspacesLimit) {
      setOpenWorkspaceLimitModal(true);
      return;
    }

    setOpenCreateWorkspaceModal(true);
  };

  const workspaceLimitModalButtons = (): [ModalButton, ModalButton] => {
    if (isFormbricksCloud) {
      return [
        {
          text: t("environments.settings.billing.upgrade"),
          href: `/workspaces/${workspace.id}/settings/billing`,
        },
        {
          text: t("common.cancel"),
          onClick: () => setOpenWorkspaceLimitModal(false),
        },
      ];
    }

    return [
      {
        text: t("environments.settings.billing.upgrade"),
        href: isLicenseActive
          ? `/workspaces/${workspace.id}/settings/enterprise`
          : "https://formbricks.com/upgrade-self-hosted-license",
      },
      {
        text: t("common.cancel"),
        onClick: () => setOpenWorkspaceLimitModal(false),
      },
    ];
  };

  const switcherTriggerClasses = cn(
    "w-full border-t px-3 py-3 text-left transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-inset",
    isCollapsed ? "flex items-center justify-center" : ""
  );

  const switcherIconClasses =
    "flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600";
  const isInitialWorkspacesLoading =
    isWorkspaceDropdownOpen && !hasInitializedWorkspaces && !workspaceLoadError;

  return (
    <>
      {workspace && (
        <aside
          className={cn(
            "z-40 flex flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100",
            isCollapsed ? "w-sidebar-expanded" : "w-sidebar-collapsed"
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
                  <Image src={FBLogo} width={160} height={30} alt={t("workspace.formbricks_logo")} />
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

            {/* Trial Days Remaining */}
            {!isCollapsed && isFormbricksCloud && trialDaysRemaining !== null && (
              <Link href={`/workspaces/${workspace.id}/settings/billing`} className="m-2 block">
                <TrialAlert trialDaysRemaining={trialDaysRemaining} size="small" />
              </Link>
            )}

            <div className="flex flex-col">
              <DropdownMenu onOpenChange={setIsWorkspaceDropdownOpen}>
                <DropdownMenuTrigger asChild id="workspaceDropdownTrigger" className={switcherTriggerClasses}>
                  <button
                    type="button"
                    aria-label={isCollapsed ? t("common.change_workspace") : undefined}
                    className={cn("flex w-full items-center gap-3", isCollapsed && "justify-center")}>
                    <span className={switcherIconClasses}>
                      <FoldersIcon className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                    {!isCollapsed && !isTextVisible && (
                      <>
                        <div className="grow overflow-hidden">
                          <p className="truncate text-sm font-bold text-slate-700">{workspace.name}</p>
                          <p className="text-sm text-slate-500">{t("common.workspace")}</p>
                        </div>
                        {isPending && (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-600" strokeWidth={1.5} />
                        )}
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.5} />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" sideOffset={10} alignOffset={5} align="end">
                  <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                    <FoldersIcon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
                    {t("common.change_workspace")}
                  </div>
                  {(isLoadingWorkspaces || isInitialWorkspacesLoading) && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {!isLoadingWorkspaces &&
                    !isInitialWorkspacesLoading &&
                    workspaceLoadError &&
                    renderSwitcherError(
                      workspaceLoadError,
                      () => {
                        setWorkspaceLoadError(null);
                        setWorkspaces([]);
                      },
                      t("common.try_again")
                    )}
                  {!isLoadingWorkspaces && !isInitialWorkspacesLoading && !workspaceLoadError && (
                    <>
                      <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                        {workspaces.map((proj) => (
                          <DropdownMenuCheckboxItem
                            key={proj.id}
                            checked={proj.id === workspace.id}
                            onClick={() => handleWorkspaceChange(proj.id)}
                            className="cursor-pointer">
                            {proj.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                      {isOwnerOrManager && (
                        <DropdownMenuCheckboxItem
                          onClick={handleWorkspaceCreate}
                          className="w-full cursor-pointer justify-between">
                          <span>{t("common.add_new_workspace")}</span>
                          <PlusIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
                        </DropdownMenuCheckboxItem>
                      )}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                      <Cog className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
                      {t("common.workspace_configuration")}
                    </div>
                    {workspaceSettings.map((setting) => (
                      <DropdownMenuCheckboxItem
                        key={setting.id}
                        checked={isActiveWorkspaceSetting(pathname, setting.id)}
                        onClick={() => handleSettingNavigation(setting.href)}
                        className="cursor-pointer">
                        {setting.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu onOpenChange={setIsOrganizationDropdownOpen}>
                <DropdownMenuTrigger
                  asChild
                  id="organizationDropdownTriggerSidebar"
                  className={switcherTriggerClasses}>
                  <button
                    type="button"
                    aria-label={isCollapsed ? t("common.change_organization") : undefined}
                    className={cn("flex w-full items-center gap-3", isCollapsed && "justify-center")}>
                    <span className={switcherIconClasses}>
                      <Building2Icon className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                    {!isCollapsed && !isTextVisible && (
                      <>
                        <div className="grow overflow-hidden">
                          <p className="truncate text-sm font-bold text-slate-700">{organization.name}</p>
                          <p className="text-sm text-slate-500">{t("common.organization")}</p>
                        </div>
                        {isPending && (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-600" strokeWidth={1.5} />
                        )}
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.5} />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" sideOffset={10} alignOffset={5} align="end">
                  <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                    <Building2Icon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
                    {t("common.change_organization")}
                  </div>
                  {isLoadingOrganizations && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {!isLoadingOrganizations &&
                    organizationLoadError &&
                    renderSwitcherError(
                      organizationLoadError,
                      () => {
                        setOrganizationLoadError(null);
                        setOrganizations([]);
                      },
                      t("common.try_again")
                    )}
                  {!isLoadingOrganizations && !organizationLoadError && (
                    <>
                      <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                        {organizations.map((org) => (
                          <DropdownMenuCheckboxItem
                            key={org.id}
                            checked={org.id === organization.id}
                            onClick={() => handleOrganizationChange(org.id)}
                            className="cursor-pointer">
                            {org.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                      {isMultiOrgEnabled && (
                        <DropdownMenuCheckboxItem
                          onClick={() => setOpenCreateOrganizationModal(true)}
                          className="w-full cursor-pointer justify-between">
                          <span>{t("common.create_new_organization")}</span>
                          <PlusIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
                        </DropdownMenuCheckboxItem>
                      )}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                      <SettingsIcon className="mr-2 inline h-4 w-4" strokeWidth={1.5} />
                      {t("common.organization_settings")}
                    </div>
                    {organizationSettings.map((setting) => {
                      if (setting.hidden) return null;
                      return (
                        <DropdownMenuCheckboxItem
                          key={setting.id}
                          checked={isActiveOrganizationSetting(pathname, setting.id)}
                          onClick={() => handleSettingNavigation(setting.href)}
                          className="cursor-pointer">
                          {setting.label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  id="userDropdownTrigger"
                  className={cn(switcherTriggerClasses, "rounded-br-xl")}>
                  <button
                    type="button"
                    aria-label={isCollapsed ? t("common.account_settings") : undefined}
                    className={cn("flex w-full items-center gap-3", isCollapsed && "justify-center")}>
                    <span className={switcherIconClasses}>
                      <ProfileAvatar userId={user.id} />
                    </span>
                    {!isCollapsed && !isTextVisible && (
                      <>
                        <div className="grow overflow-hidden">
                          <p
                            title={user?.email}
                            className="ph-no-capture ph-no-capture -mb-0.5 truncate text-sm font-bold text-slate-700">
                            {user?.name ? <span>{user?.name}</span> : <span>{user?.email}</span>}
                          </p>
                          <p className="text-sm text-slate-500">{t("common.account")}</p>
                        </div>
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.5} />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  id="userDropdownInnerContentWrapper"
                  side="right"
                  sideOffset={10}
                  alignOffset={5}
                  align="end">
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
                  <DropdownMenuItem
                    onClick={async () => {
                      const loginUrl = `${publicDomain}/auth/login`;
                      const route = await signOutWithAudit({
                        reason: "user_initiated",
                        redirectUrl: loginUrl,
                        organizationId: organization.id,
                        redirect: false,
                        callbackUrl: loginUrl,
                        clearWorkspaceId: true,
                      });
                      router.push(route?.url || loginUrl); // NOSONAR // We want to check for empty strings
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
      {openWorkspaceLimitModal && (
        <WorkspaceLimitModal
          open={openWorkspaceLimitModal}
          setOpen={setOpenWorkspaceLimitModal}
          buttons={workspaceLimitModalButtons()}
          workspaceLimit={organizationWorkspacesLimit}
        />
      )}
      {openCreateWorkspaceModal && (
        <CreateWorkspaceModal
          open={openCreateWorkspaceModal}
          setOpen={setOpenCreateWorkspaceModal}
          organizationId={organization.id}
          isAccessControlAllowed={isAccessControlAllowed}
        />
      )}
      {openCreateOrganizationModal && (
        <CreateOrganizationModal
          open={openCreateOrganizationModal}
          setOpen={setOpenCreateOrganizationModal}
        />
      )}
    </>
  );
};
