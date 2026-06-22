"use client";

import {
  ArrowUpRightIcon,
  BarChart3Icon,
  Building2Icon,
  ChevronRightIcon,
  Cog,
  FoldersIcon,
  Loader2,
  LogOutIcon,
  MessageCircle,
  MessageSquareTextIcon,
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
import { SettingsSidebarContent } from "@/app/(app)/workspaces/[workspaceId]/components/SettingsSidebarContent";
import { isNewerVersion } from "@/app/(app)/workspaces/[workspaceId]/lib/utils";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { TrialAlert } from "@/modules/ee/billing/components/trial-alert";
import { TRIAL_BASE_RESPONSE_LIMIT, TrialBannerNew } from "@/modules/ee/billing/components/trial-banner-new";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import { Badge } from "@/modules/ui/components/badge";
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
import { GoBackButton } from "@/modules/ui/components/go-back-button";
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
  organizationWorkspacesLimit: number;
  isLicenseActive: boolean;
  isAccessControlAllowed: boolean;
  responseCount: number;
  newTrialBannerVariant: string | boolean;
}

export const MainNavigation = ({
  organization,
  user,
  workspace,
  membershipRole,
  isFormbricksCloud,
  isDevelopment,
  publicDomain,
  organizationWorkspacesLimit,
  isLicenseActive,
  isAccessControlAllowed,
  responseCount,
  newTrialBannerVariant,
}: NavigationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [latestVersion, setLatestVersion] = useState("");
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });

  const [isPending, startTransition] = useTransition();
  const { isManager, isOwner, isBilling } = getAccessFlags(membershipRole);
  const isMembershipPending = membershipRole === undefined;
  const disabledNavigationMessage = isMembershipPending
    ? t("common.loading")
    : t("common.you_are_not_authorized_to_perform_this_action");

  const isOwnerOrManager = isManager || isOwner;
  const isSettingsMode = pathname?.includes("/settings");

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

  const mainNavigationSections = useMemo(
    () => [
      {
        id: "ask",
        name: t("common.ask"),
        items: [
          {
            name: t("common.surveys"),
            href: `/workspaces/${workspace.id}/surveys`,
            icon: MessageCircle,
            isActive: pathname?.includes("/surveys"),
            isHidden: false,
            disabled: isMembershipPending || isBilling,
          },
          {
            href: `/workspaces/${workspace.id}/contacts`,
            name: t("common.contacts"),
            icon: UserIcon,
            isActive:
              pathname?.includes("/contacts") ||
              pathname?.includes("/segments") ||
              pathname?.includes("/attributes"),
            disabled: isMembershipPending || isBilling,
          },
        ],
      },
      {
        id: "unify-feedback",
        name: (
          <span className="inline-flex items-center gap-2">
            <span>{t("workspace.unify.unify_feedback")}</span>
            <Badge
              text="Beta"
              type="gray"
              size="tiny"
              className="text-[10px] font-semibold tracking-normal normal-case"
            />
          </span>
        ),
        items: [
          {
            name: t("workspace.unify.feedback_records"),
            href: `/workspaces/${workspace.id}/unify/feedback-records`,
            icon: MessageSquareTextIcon,
            isActive: pathname?.includes("/unify/"),
            isHidden: false,
            disabled: isMembershipPending || isBilling,
          },
          {
            name: t("common.dashboards"),
            href: `/workspaces/${workspace.id}/dashboards`,
            icon: BarChart3Icon,
            isActive: pathname?.includes("/dashboards") || pathname?.includes("/charts"),
            isHidden: false,
            disabled: isMembershipPending || isBilling,
          },
        ],
      },
    ],
    [t, workspace.id, pathname, isMembershipPending, isBilling]
  );

  const settingsNavigationItem = useMemo(
    () => ({
      name: t("common.settings"),
      href: `/workspaces/${workspace.id}/settings/workspace/general`,
      icon: SettingsIcon,
      isActive: isSettingsMode,
      disabled: isMembershipPending || isBilling,
    }),
    [t, workspace.id, isSettingsMode, isMembershipPending, isBilling]
  );

  const dropdownNavigation = [
    {
      label: t("common.account"),
      href: `/workspaces/${workspace.id}/settings/account/profile`,
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
  const [openWorkspaceLimitModal, setOpenWorkspaceLimitModal] = useState(false);

  const renderSwitcherError = (error: string, onRetry: () => void, retryLabel: string) => (
    <div className="px-2 py-4">
      <p className="mb-2 text-sm text-red-600">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-slate-600 underline hover:text-slate-800">
        {retryLabel}
      </button>
    </div>
  );

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

  const mainNavigationLink = isBilling
    ? getBillingFallbackPath(workspace.id, isFormbricksCloud)
    : `/workspaces/${workspace.id}/surveys/`;

  const handleWorkspaceChange = (workspaceId: string) => {
    const targetPath =
      workspaceId === workspace.id ? `/workspaces/${workspace.id}/surveys` : `/workspaces/${workspaceId}/`;
    startTransition(() => {
      setIsWorkspaceDropdownOpen(false);
      router.push(targetPath);
    });
  };

  const handleOrganizationChange = (organizationId: string) => {
    const targetPath =
      organizationId === organization.id
        ? `/workspaces/${workspace.id}/settings/organization/general`
        : `/organizations/${organizationId}/`;
    startTransition(() => {
      setIsOrganizationDropdownOpen(false);
      router.push(targetPath);
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
          text: t("workspace.settings.billing.upgrade"),
          href: `/workspaces/${workspace.id}/settings/organization/billing`,
        },
        {
          text: t("common.cancel"),
          onClick: () => setOpenWorkspaceLimitModal(false),
        },
      ];
    }

    return [
      {
        text: t("workspace.settings.billing.upgrade"),
        href: isLicenseActive
          ? `/workspaces/${workspace.id}/settings/organization/enterprise`
          : "https://formbricks.com/upgrade-self-hosted-license",
      },
      {
        text: t("common.cancel"),
        onClick: () => setOpenWorkspaceLimitModal(false),
      },
    ];
  };

  const handleSettingsWorkspaceChange = useCallback(
    (id: string) => {
      startTransition(() => {
        router.push(`/workspaces/${id}/settings/workspace/general`);
      });
    },
    [router]
  );

  const handleSettingsOrganizationChange = useCallback(
    (id: string) => {
      startTransition(() => {
        if (id === organization.id) {
          router.push(`/workspaces/${workspace.id}/settings/organization/general`);
        } else {
          router.push(`/organizations/${id}/`);
        }
      });
    },
    [router, organization.id, workspace.id]
  );

  const switcherTriggerClasses = cn(
    "w-full border-t px-3 py-3 text-left transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-inset",
    isCollapsed ? "flex items-center justify-center" : ""
  );

  const switcherIconClasses =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600";
  const mainNavIconClassName = "h-4 w-4 shrink-0";
  const isInitialWorkspacesLoading =
    isWorkspaceDropdownOpen && !hasInitializedWorkspaces && !workspaceLoadError;

  return (
    <>
      {workspace && (
        <aside
          className={cn(
            "z-40 flex flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100",
            isSettingsMode || !isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"
          )}>
          {isSettingsMode ? (
            <div className="flex flex-col overflow-hidden">
              <div className="mb-2 px-3">
                <GoBackButton url={`/workspaces/${workspace.id}/surveys`} />
              </div>

              {/* Settings sidebar content */}
              <SettingsSidebarContent
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                organizationId={organization.id}
                organizationName={organization.name}
                membershipRole={membershipRole}
                isFormbricksCloud={isFormbricksCloud}
                isCollapsed={false}
                isTextVisible={false}
                workspaces={workspaces}
                isLoadingWorkspaces={isLoadingWorkspaces}
                onWorkspaceChange={handleSettingsWorkspaceChange}
                onWorkspaceDropdownOpen={loadWorkspaces}
                organizations={organizations}
                isLoadingOrganizations={isLoadingOrganizations}
                onOrganizationChange={handleSettingsOrganizationChange}
                onOrganizationDropdownOpen={loadOrganizations}
              />
            </div>
          ) : (
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
                    "rounded-xl bg-slate-50 p-1 text-slate-600 transition-all hover:bg-slate-100 focus:ring-0 focus:ring-transparent focus:outline-hidden"
                  )}>
                  {isCollapsed ? (
                    <PanelLeftOpenIcon strokeWidth={1.5} />
                  ) : (
                    <PanelLeftCloseIcon strokeWidth={1.5} />
                  )}
                </Button>
              </div>

              {/* Main Nav */}
              <ul className="space-y-2">
                {mainNavigationSections.map((section) => (
                  <li key={section.id}>
                    {!isCollapsed && !isTextVisible && (
                      <p className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        {section.name}
                      </p>
                    )}

                    <ul>
                      {section.items.map(
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
                              <item.icon className={mainNavIconClassName} strokeWidth={1.5} />
                            </NavigationLink>
                          )
                      )}
                    </ul>
                  </li>
                ))}

                <li className={cn("mt-2 border-t border-slate-100 pt-2", isCollapsed && "border-t-0 pt-0")}>
                  <ul>
                    <NavigationLink
                      href={settingsNavigationItem.href}
                      isActive={settingsNavigationItem.isActive}
                      isCollapsed={isCollapsed}
                      isTextVisible={isTextVisible}
                      disabled={settingsNavigationItem.disabled}
                      disabledMessage={
                        settingsNavigationItem.disabled ? disabledNavigationMessage : undefined
                      }
                      linkText={settingsNavigationItem.name}>
                      <settingsNavigationItem.icon className={mainNavIconClassName} strokeWidth={1.5} />
                    </NavigationLink>
                  </ul>
                </li>
              </ul>
            </div>
          )}

          <div>
            {!isSettingsMode && (
              <>
                {/* New Version Available */}
                {!isCollapsed &&
                  isOwnerOrManager &&
                  latestVersion &&
                  !isFormbricksCloud &&
                  !isDevelopment && (
                    <Link
                      href="https://github.com/formbricks/formbricks/releases"
                      target="_blank"
                      className="m-2 flex items-center gap-x-4 rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-200">
                      <p className="flex items-center justify-center gap-x-2 text-xs">
                        <RocketIcon strokeWidth={1.5} className="mx-1 size-6 text-slate-900" />
                        {t("common.new_version_available", { version: latestVersion })}
                      </p>
                    </Link>
                  )}

                {/* Trial Days Remaining */}
                {!isCollapsed &&
                  isFormbricksCloud &&
                  trialDaysRemaining !== null &&
                  (newTrialBannerVariant === "new-trial-banner" ? (
                    <TrialBannerNew
                      trialDaysRemaining={trialDaysRemaining}
                      planName={organization.billing.stripe?.plan ?? "pro"}
                      responseCount={responseCount}
                      responseLimit={organization.billing.limits.monthly.responses}
                      baseResponseLimit={TRIAL_BASE_RESPONSE_LIMIT}
                      billingHref={`/workspaces/${workspace.id}/settings/organization/billing`}
                    />
                  ) : (
                    <Link
                      href={`/workspaces/${workspace.id}/settings/organization/billing`}
                      className="m-2 block">
                      <TrialAlert trialDaysRemaining={trialDaysRemaining} size="small" />
                    </Link>
                  ))}
              </>
            )}

            <div className="flex flex-col">
              {!isSettingsMode && (
                <>
                  <DropdownMenu onOpenChange={setIsWorkspaceDropdownOpen}>
                    <DropdownMenuTrigger
                      asChild
                      id="workspaceDropdownTrigger"
                      className={switcherTriggerClasses}>
                      <button
                        type="button"
                        aria-label={isCollapsed ? t("common.change_workspace") : undefined}
                        className={cn("flex w-full items-center gap-3", isCollapsed && "justify-center")}>
                        <span className={switcherIconClasses}>
                          <FoldersIcon className="size-4" strokeWidth={1.5} />
                        </span>
                        {!isCollapsed && !isTextVisible && (
                          <>
                            <div className="grow overflow-hidden">
                              <p className="truncate text-sm font-bold text-slate-700">{workspace.name}</p>
                              <p className="text-sm text-slate-500">{t("common.workspace")}</p>
                            </div>
                            {isPending && (
                              <Loader2 className="size-4 animate-spin text-slate-600" strokeWidth={1.5} />
                            )}
                            <ChevronRightIcon className="size-4 shrink-0 text-slate-600" strokeWidth={1.5} />
                          </>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" sideOffset={10} alignOffset={5} align="end">
                      <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                        <FoldersIcon className="mr-2 inline size-4" strokeWidth={1.5} />
                        {t("common.change_workspace")}
                      </div>
                      {(isLoadingWorkspaces || isInitialWorkspacesLoading) && (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="size-4 animate-spin" />
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
                              <PlusIcon className="ml-2 size-4" strokeWidth={1.5} />
                            </DropdownMenuCheckboxItem>
                          )}
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        onClick={() =>
                          handleSettingNavigation(`/workspaces/${workspace.id}/settings/workspace/general`)
                        }
                        className="cursor-pointer">
                        <Cog className="mr-2 size-4" strokeWidth={1.5} />
                        {t("common.settings")}
                      </DropdownMenuCheckboxItem>
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
                          <Building2Icon className="size-4" strokeWidth={1.5} />
                        </span>
                        {!isCollapsed && !isTextVisible && (
                          <>
                            <div className="grow overflow-hidden">
                              <p className="truncate text-sm font-bold text-slate-700">{organization.name}</p>
                              <p className="text-sm text-slate-500">{t("common.organization")}</p>
                            </div>
                            {isPending && (
                              <Loader2 className="size-4 animate-spin text-slate-600" strokeWidth={1.5} />
                            )}
                            <ChevronRightIcon className="size-4 shrink-0 text-slate-600" strokeWidth={1.5} />
                          </>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" sideOffset={10} alignOffset={5} align="end">
                      <div className="px-2 py-1.5 text-sm font-medium text-slate-500">
                        <Building2Icon className="mr-2 inline size-4" strokeWidth={1.5} />
                        {t("common.change_organization")}
                      </div>
                      {isLoadingOrganizations && (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="size-4 animate-spin" />
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
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        onClick={() =>
                          handleSettingNavigation(`/workspaces/${workspace.id}/settings/organization/general`)
                        }
                        className="cursor-pointer">
                        <SettingsIcon className="mr-2 size-4" strokeWidth={1.5} />
                        {t("common.settings")}
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

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
                            className="ph-no-capture -mb-0.5 truncate text-sm font-bold text-slate-700">
                            {user?.name ? <span>{user?.name}</span> : <span>{user?.email}</span>}
                          </p>
                          <p className="text-sm text-slate-500">{t("common.account")}</p>
                        </div>
                        <ChevronRightIcon className="size-4 shrink-0 text-slate-600" strokeWidth={1.5} />
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
                        <link.icon className="mr-2 size-4" strokeWidth={1.5} />
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
                      router.push(route?.url || loginUrl);
                    }}
                    icon={<LogOutIcon className="mr-2 size-4" strokeWidth={1.5} />}>
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
    </>
  );
};
