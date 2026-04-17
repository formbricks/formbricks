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
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import {
  getOrganizationsForSwitcherAction,
  getProjectsForSwitcherAction,
} from "@/app/(app)/environments/[environmentId]/actions";
import { NavigationLink } from "@/app/(app)/environments/[environmentId]/components/NavigationLink";
import { isNewerVersion } from "@/app/(app)/environments/[environmentId]/lib/utils";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { TrialAlert } from "@/modules/ee/billing/components/trial-alert";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { CreateProjectModal } from "@/modules/projects/components/create-project-modal";
import { ProjectLimitModal } from "@/modules/projects/components/project-limit-modal";
import { getLatestStableFbReleaseAction } from "@/modules/projects/settings/(setup)/app-connection/actions";
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
import packageJson from "../../../../../package.json";

interface NavigationProps {
  environment: TEnvironment;
  user: TUser;
  organization: TOrganization;
  project: { id: string; name: string };
  isFormbricksCloud: boolean;
  isDevelopment: boolean;
  membershipRole?: TOrganizationRole;
  publicDomain: string;
  isMultiOrgEnabled: boolean;
  organizationProjectsLimit: number;
  isLicenseActive: boolean;
  isAccessControlAllowed: boolean;
}

const isActiveProjectSetting = (pathname: string, settingId: string): boolean => {
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
  environment,
  organization,
  user,
  project,
  membershipRole,
  isFormbricksCloud,
  isDevelopment,
  publicDomain,
  isMultiOrgEnabled,
  organizationProjectsLimit,
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
  const isMembershipPending = membershipRole === undefined;
  const disabledNavigationMessage = isMembershipPending
    ? t("common.loading")
    : t("common.you_are_not_authorized_to_perform_this_action");

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
        disabled: isMembershipPending || isBilling,
      },
      {
        href: `/environments/${environment.id}/contacts`,
        name: t("common.contacts"),
        icon: UserIcon,
        isActive:
          pathname?.includes("/contacts") ||
          pathname?.includes("/segments") ||
          pathname?.includes("/attributes"),
        disabled: isMembershipPending || isBilling,
      },
      {
        name: t("common.configuration"),
        href: `/environments/${environment.id}/workspace/general`,
        icon: Cog,
        isActive: pathname?.includes("/workspace"),
        disabled: isMembershipPending || isBilling,
      },
    ],
    [t, environment.id, pathname, isMembershipPending, isBilling]
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

  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [hasInitializedProjects, setHasInitializedProjects] = useState(false);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [organizationLoadError, setOrganizationLoadError] = useState<string | null>(null);
  const [openCreateProjectModal, setOpenCreateProjectModal] = useState(false);
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState(false);
  const [openProjectLimitModal, setOpenProjectLimitModal] = useState(false);

  const renderSwitcherError = (error: string, onRetry: () => void, retryLabel: string) => (
    <div className="px-2 py-4">
      <p className="mb-2 text-sm text-red-600">{error}</p>
      <button onClick={onRetry} className="text-xs text-slate-600 underline hover:text-slate-800">
        {retryLabel}
      </button>
    </div>
  );

  const projectSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${environment.id}/workspace/general`,
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      href: `/environments/${environment.id}/workspace/look`,
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      href: `/environments/${environment.id}/workspace/app-connection`,
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      href: `/environments/${environment.id}/workspace/integrations`,
    },
    {
      id: "teams",
      label: t("common.team_access"),
      href: `/environments/${environment.id}/workspace/teams`,
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      href: `/environments/${environment.id}/workspace/languages`,
    },
    {
      id: "tags",
      label: t("common.tags"),
      href: `/environments/${environment.id}/workspace/tags`,
    },
  ];

  const organizationSettings = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${environment.id}/settings/general`,
    },
    {
      id: "teams",
      label: t("common.members_and_teams"),
      href: `/environments/${environment.id}/settings/teams`,
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `/environments/${environment.id}/settings/api-keys`,
      hidden: !isOwnerOrManager,
    },
    {
      id: "domain",
      label: t("common.domain"),
      href: `/environments/${environment.id}/settings/domain`,
      hidden: isFormbricksCloud,
    },
    {
      id: "billing",
      label: t("common.billing"),
      href: `/environments/${environment.id}/settings/billing`,
      hidden: !isFormbricksCloud,
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `/environments/${environment.id}/settings/enterprise`,
      hidden: isFormbricksCloud || isMember,
    },
  ];

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setWorkspaceLoadError(null);

    try {
      const result = await getProjectsForSwitcherAction({ organizationId: organization.id });
      if (result?.data) {
        const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
        setProjects(sorted);
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
      setIsLoadingProjects(false);
      setHasInitializedProjects(true);
    }
  }, [organization.id, t]);

  useEffect(() => {
    if (!isWorkspaceDropdownOpen || projects.length > 0 || isLoadingProjects || workspaceLoadError) {
      return;
    }

    loadProjects();
  }, [isWorkspaceDropdownOpen, projects.length, isLoadingProjects, workspaceLoadError, loadProjects]);

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

  const mainNavigationLink = isBilling
    ? getBillingFallbackPath(environment.id, isFormbricksCloud)
    : `/environments/${environment.id}/surveys/`;

  const handleProjectChange = (projectId: string) => {
    if (projectId === project.id) return;
    startTransition(() => {
      router.push(`/workspaces/${projectId}/`);
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

  const handleProjectCreate = () => {
    if (!hasInitializedProjects || isLoadingProjects) {
      return;
    }

    if (projects.length >= organizationProjectsLimit) {
      setOpenProjectLimitModal(true);
      return;
    }

    setOpenCreateProjectModal(true);
  };

  const projectLimitModalButtons = (): [ModalButton, ModalButton] => {
    if (isFormbricksCloud) {
      return [
        {
          text: t("environments.settings.billing.upgrade"),
          href: `/environments/${environment.id}/settings/billing`,
        },
        {
          text: t("common.cancel"),
          onClick: () => setOpenProjectLimitModal(false),
        },
      ];
    }

    return [
      {
        text: t("environments.settings.billing.upgrade"),
        href: isLicenseActive
          ? `/environments/${environment.id}/settings/enterprise`
          : "https://formbricks.com/upgrade-self-hosted-license",
      },
      {
        text: t("common.cancel"),
        onClick: () => setOpenProjectLimitModal(false),
      },
    ];
  };

  const switcherTriggerClasses = cn(
    "w-full border-t px-3 py-3 text-left transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-inset",
    isCollapsed ? "flex items-center justify-center" : ""
  );

  const switcherIconClasses =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600";
  const isInitialProjectsLoading = isWorkspaceDropdownOpen && !hasInitializedProjects && !workspaceLoadError;

  return (
    <>
      {project && (
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
                      disabled={item.disabled}
                      disabledMessage={item.disabled ? disabledNavigationMessage : undefined}
                      linkText={item.name}>
                      <item.icon strokeWidth={1.5} />
                    </NavigationLink>
                  )
              )}
            </ul>
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
              <Link href={`/environments/${environment.id}/settings/billing`} className="m-2 block">
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
                          <p className="truncate text-sm font-bold text-slate-700">{project.name}</p>
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
                  {(isLoadingProjects || isInitialProjectsLoading) && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {!isLoadingProjects &&
                    !isInitialProjectsLoading &&
                    workspaceLoadError &&
                    renderSwitcherError(
                      workspaceLoadError,
                      () => {
                        setWorkspaceLoadError(null);
                        setProjects([]);
                      },
                      t("common.try_again")
                    )}
                  {!isLoadingProjects && !isInitialProjectsLoading && !workspaceLoadError && (
                    <>
                      <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
                        {projects.map((proj) => (
                          <DropdownMenuCheckboxItem
                            key={proj.id}
                            checked={proj.id === project.id}
                            onClick={() => handleProjectChange(proj.id)}
                            className="cursor-pointer">
                            {proj.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                      {isOwnerOrManager && (
                        <DropdownMenuCheckboxItem
                          onClick={handleProjectCreate}
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
                    {projectSettings.map((setting) => (
                      <DropdownMenuCheckboxItem
                        key={setting.id}
                        checked={isActiveProjectSetting(pathname, setting.id)}
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
                        clearEnvironmentId: true,
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
      {openProjectLimitModal && (
        <ProjectLimitModal
          open={openProjectLimitModal}
          setOpen={setOpenProjectLimitModal}
          buttons={projectLimitModalButtons()}
          projectLimit={organizationProjectsLimit}
        />
      )}
      {openCreateProjectModal && (
        <CreateProjectModal
          open={openCreateProjectModal}
          setOpen={setOpenCreateProjectModal}
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
