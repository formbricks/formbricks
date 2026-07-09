"use client";

import {
  BarChart3Icon,
  Building2Icon,
  ChevronRightIcon,
  FoldersIcon,
  Loader2,
  MessageCircle,
  MessageSquareTextIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  UserIcon,
  WorkflowIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import posthog from "posthog-js";
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
import { TrialAlert } from "@/modules/ee/billing/components/trial-alert";
import { TRIAL_BASE_RESPONSE_LIMIT, TrialBannerNew } from "@/modules/ee/billing/components/trial-banner-new";
import { SwitcherDropdownBody } from "@/modules/settings/components/switcher-dropdown-body";
import { UserDropdown } from "@/modules/settings/components/user-dropdown";
import { useSwitcherData } from "@/modules/settings/hooks/use-switcher-data";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
            name: t("workspace.unify.feedback_data"),
            href: `/workspaces/${workspace.id}/unify/sources`,
            icon: MessageSquareTextIcon,
            isActive: pathname?.includes("/unify/"),
            isHidden: false,
            disabled: isMembershipPending || isBilling,
          },
          {
            name: t("common.analysis"),
            href: `/workspaces/${workspace.id}/dashboards`,
            icon: BarChart3Icon,
            isActive: pathname?.includes("/dashboards") || pathname?.includes("/charts"),
            isHidden: false,
            disabled: isMembershipPending || isBilling,
          },
        ],
      },
      {
        id: "act",
        name: t("common.act"),
        items: [
          {
            name: t("common.workflows"),
            href: `/workspaces/${workspace.id}/workflows`,
            icon: WorkflowIcon,
            isActive: pathname?.startsWith(`/workspaces/${workspace.id}/workflows`),
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

  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
  const workspaceSwitcher = useSwitcherData(
    () => getWorkspacesForSwitcherAction({ organizationId: organization.id }),
    t("common.failed_to_load_workspaces")
  );
  const organizationSwitcher = useSwitcherData(
    () => getOrganizationsForSwitcherAction({ organizationId: organization.id }),
    t("common.failed_to_load_organizations")
  );
  const { load: loadWorkspaces } = workspaceSwitcher;
  const { load: loadOrganizations } = organizationSwitcher;
  const [openCreateWorkspaceModal, setOpenCreateWorkspaceModal] = useState(false);
  const [openWorkspaceLimitModal, setOpenWorkspaceLimitModal] = useState(false);

  useEffect(() => {
    // The hook guards against duplicate/looping loads internally.
    if (isWorkspaceDropdownOpen) {
      void loadWorkspaces();
    }
  }, [isWorkspaceDropdownOpen, loadWorkspaces]);

  useEffect(() => {
    if (isOrganizationDropdownOpen) {
      void loadOrganizations();
    }
  }, [isOrganizationDropdownOpen, loadOrganizations]);

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
    ? getBillingFallbackPath(organization.id, isFormbricksCloud)
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
        ? `/organizations/${organization.id}/settings/general`
        : `/organizations/${organizationId}/`;
    startTransition(() => {
      setIsOrganizationDropdownOpen(false);
      router.push(targetPath);
    });
  };

  const handleWorkspaceCreate = () => {
    if (!workspaceSwitcher.hasLoaded || workspaceSwitcher.isLoading) {
      return;
    }

    if (workspaceSwitcher.items.length >= organizationWorkspacesLimit) {
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
          href: `/organizations/${organization.id}/settings/billing`,
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
          ? `/organizations/${organization.id}/settings/enterprise`
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
          router.push(`/organizations/${organization.id}/settings/general`);
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
    isWorkspaceDropdownOpen && !workspaceSwitcher.hasLoaded && !workspaceSwitcher.error;

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
                workspaces={workspaceSwitcher.items}
                isLoadingWorkspaces={workspaceSwitcher.isLoading}
                onWorkspaceChange={handleSettingsWorkspaceChange}
                onWorkspaceDropdownOpen={() =>
                  workspaceSwitcher.error ? workspaceSwitcher.retry() : workspaceSwitcher.load()
                }
                errorWorkspaces={workspaceSwitcher.error}
                onWorkspaceRetry={workspaceSwitcher.retry}
                organizations={organizationSwitcher.items}
                isLoadingOrganizations={organizationSwitcher.isLoading}
                onOrganizationChange={handleSettingsOrganizationChange}
                onOrganizationDropdownOpen={() =>
                  organizationSwitcher.error ? organizationSwitcher.retry() : organizationSwitcher.load()
                }
                errorOrganizations={organizationSwitcher.error}
                onOrganizationRetry={organizationSwitcher.retry}
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
                  (newTrialBannerVariant === "test" ? (
                    <TrialBannerNew
                      trialDaysRemaining={trialDaysRemaining}
                      planName={organization.billing.stripe?.plan ?? "pro"}
                      responseCount={responseCount}
                      responseLimit={organization.billing.limits.monthly.responses}
                      baseResponseLimit={TRIAL_BASE_RESPONSE_LIMIT}
                      billingHref={`/organizations/${organization.id}/settings/billing`}
                    />
                  ) : (
                    <Link
                      href={`/organizations/${organization.id}/settings/billing`}
                      className="m-2 block"
                      onClick={() => posthog.capture("main_nav_go_to_billing_clicked")}>
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
                        aria-label={isCollapsed ? t("common.choose_workspace") : undefined}
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
                      <SwitcherDropdownBody
                        type="workspace"
                        isLoading={workspaceSwitcher.isLoading || isInitialWorkspacesLoading}
                        error={workspaceSwitcher.error}
                        onRetry={workspaceSwitcher.retry}
                        items={workspaceSwitcher.items}
                        selectedId={workspace.id}
                        onSelect={handleWorkspaceChange}>
                        {isOwnerOrManager && (
                          <DropdownMenuCheckboxItem
                            onClick={handleWorkspaceCreate}
                            className="w-full cursor-pointer justify-between">
                            <span>{t("common.add_new_workspace")}</span>
                            <PlusIcon className="ml-2 size-4" strokeWidth={1.5} />
                          </DropdownMenuCheckboxItem>
                        )}
                      </SwitcherDropdownBody>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu onOpenChange={setIsOrganizationDropdownOpen}>
                    <DropdownMenuTrigger
                      asChild
                      id="organizationDropdownTriggerSidebar"
                      className={switcherTriggerClasses}>
                      <button
                        type="button"
                        aria-label={isCollapsed ? t("common.choose_organization") : undefined}
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
                      <SwitcherDropdownBody
                        type="organization"
                        isLoading={organizationSwitcher.isLoading}
                        error={organizationSwitcher.error}
                        onRetry={organizationSwitcher.retry}
                        items={organizationSwitcher.items}
                        selectedId={organization.id}
                        onSelect={handleOrganizationChange}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

              <UserDropdown
                user={user}
                organizationId={organization.id}
                publicDomain={publicDomain}
                isCollapsed={isCollapsed}
                isTextVisible={isTextVisible}
                className="rounded-br-xl"
              />
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
