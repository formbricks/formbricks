"use client";

import {
  BellIcon,
  BlocksIcon,
  BrushIcon,
  Building2Icon,
  ChevronDownIcon,
  CreditCardIcon,
  FoldersIcon,
  GlobeIcon,
  KeyIcon,
  LanguagesIcon,
  ListChecksIcon,
  Loader2,
  ShapesIcon,
  ShieldIcon,
  TagIcon,
  UnplugIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { cn } from "@/lib/cn";
import { getAccessFlags } from "@/lib/membership/utils";
import {
  accountSettingsPath,
  organizationSettingsPath,
  workspaceSettingsPath,
} from "@/modules/settings/lib/routes";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface SettingsSidebarContentProps {
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  membershipRole?: TOrganizationRole;
  isFormbricksCloud: boolean;
  isCollapsed: boolean;
  isTextVisible: boolean;
  // Hidden when the user has no workspace (org/account settings still render).
  hideWorkspaceSection?: boolean;
  // Workspace switcher
  workspaces: { id: string; name: string }[];
  isLoadingWorkspaces: boolean;
  onWorkspaceChange: (id: string) => void;
  onWorkspaceDropdownOpen: () => void;
  errorWorkspaces?: string | null;
  onWorkspaceRetry?: () => void;
  // Organization switcher
  organizations: { id: string; name: string }[];
  isLoadingOrganizations: boolean;
  onOrganizationChange: (id: string) => void;
  onOrganizationDropdownOpen: () => void;
  errorOrganizations?: string | null;
  onOrganizationRetry?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  hidden?: boolean;
  disabled?: boolean;
}

const SettingsNavLink = ({
  item,
  isActive,
  isCollapsed,
  isTextVisible,
  disabledMessage,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  isTextVisible: boolean;
  disabledMessage?: string;
}) => {
  const activeClass = "bg-slate-50 border-r-4 border-brand-dark font-semibold text-slate-900";
  const inactiveClass =
    "hover:bg-slate-50 border-r-4 border-transparent hover:border-slate-300 transition-all duration-150 ease-in-out";
  const disabledClass = "cursor-not-allowed border-r-4 border-transparent text-slate-400";

  const isDisabled = item.disabled;

  const getStateClass = () => {
    if (isDisabled) return disabledClass;
    return isActive ? activeClass : inactiveClass;
  };

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <li className={cn("rounded-l-md py-1.5 pl-2 text-sm", getStateClass())}>
              {isDisabled ? (
                <div className="flex items-center">{item.icon}</div>
              ) : (
                <Link href={item.href} className="flex items-center text-slate-600 hover:text-slate-900">
                  {item.icon}
                </Link>
              )}
            </li>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isDisabled ? disabledMessage || item.label : item.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isDisabled) {
    return (
      <li className={cn("rounded-l-md py-1.5 pl-8 text-sm", disabledClass)}>
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex items-center">
              {item.icon}
              <span
                className={cn(
                  "ml-2 transition-opacity duration-100",
                  isTextVisible ? "opacity-0" : "opacity-100"
                )}>
                {item.label}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-fit max-w-72 px-3 py-2 text-sm text-slate-700">
            {disabledMessage || item.label}
          </PopoverContent>
        </Popover>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "rounded-l-md py-1.5 pl-8 text-sm",
        isActive ? activeClass : inactiveClass,
        "text-slate-600 hover:text-slate-900"
      )}>
      <Link href={item.href} className="flex items-center">
        {item.icon}
        <span
          className={cn("ml-2 transition-opacity duration-100", isTextVisible ? "opacity-0" : "opacity-100")}>
          {item.label}
        </span>
      </Link>
    </li>
  );
};

const SectionHeader = ({
  label,
  isCollapsed,
  isTextVisible,
  switcherName,
  switcherItems,
  isLoadingSwitcher,
  errorSwitcher,
  onSwitcherRetry,
  currentId,
  onSwitcherChange,
  onSwitcherOpen,
}: Readonly<{
  label: string;
  isCollapsed: boolean;
  isTextVisible: boolean;
  switcherName?: string;
  switcherItems?: { id: string; name: string }[];
  isLoadingSwitcher?: boolean;
  errorSwitcher?: string | null;
  onSwitcherRetry?: () => void;
  currentId?: string;
  onSwitcherChange?: (id: string) => void;
  onSwitcherOpen?: () => void;
}>) => {
  const { t } = useTranslation();

  if (isCollapsed) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-4 mb-1 flex min-w-0 items-center gap-2 px-4",
        isTextVisible ? "opacity-0" : "opacity-100"
      )}>
      <span className="shrink-0 text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</span>
      {switcherName && switcherItems && onSwitcherChange && (
        <DropdownMenu onOpenChange={(open) => open && onSwitcherOpen?.()}>
          <DropdownMenuTrigger className="ml-auto flex max-w-[50%] min-w-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">
            <span className="truncate">{switcherName}</span>
            <ChevronDownIcon className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[300px]">
            {isLoadingSwitcher ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : errorSwitcher ? (
              <div className="px-2 py-4 text-center">
                <p className="mb-2 text-sm text-red-600">{errorSwitcher}</p>
                <button
                  type="button"
                  onClick={onSwitcherRetry}
                  className="text-xs text-slate-600 underline hover:text-slate-800">
                  {t("common.try_again")}
                </button>
              </div>
            ) : (
              <DropdownMenuGroup className="overflow-y-auto">
                {switcherItems.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.id}
                    checked={item.id === currentId}
                    onClick={() => onSwitcherChange(item.id)}
                    className="cursor-pointer text-sm">
                    {item.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export const SettingsSidebarContent = ({
  workspaceId,
  workspaceName,
  organizationId,
  organizationName,
  membershipRole,
  isFormbricksCloud,
  isCollapsed,
  isTextVisible,
  hideWorkspaceSection = false,
  workspaces,
  isLoadingWorkspaces,
  onWorkspaceChange,
  onWorkspaceDropdownOpen,
  errorWorkspaces,
  onWorkspaceRetry,
  organizations,
  isLoadingOrganizations,
  onOrganizationChange,
  onOrganizationDropdownOpen,
  errorOrganizations,
  onOrganizationRetry,
}: SettingsSidebarContentProps) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isMember, isBilling, isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const iconClassName = "h-4 w-4 shrink-0";

  // Workspace items stay nested under the workspace; organization and account settings are now
  // scoped to their own top-level routes so they work with or without a current workspace. Paths
  // come from the shared route helpers so they can't drift from redirects/other navigation.
  const workspaceItems: NavItem[] = [
    {
      id: "general",
      label: t("common.general"),
      href: workspaceSettingsPath(workspaceId, "general"),
      icon: <FoldersIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "teams",
      label: t("common.team_access"),
      href: workspaceSettingsPath(workspaceId, "teams"),
      icon: <UsersIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      href: workspaceSettingsPath(workspaceId, "languages"),
      icon: <LanguagesIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "app-connection",
      label: t("common.connect_your_app"),
      href: workspaceSettingsPath(workspaceId, "app-connection"),
      icon: <UnplugIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "feedback-sources",
      label: t("workspace.unify.feedback_sources"),
      href: workspaceSettingsPath(workspaceId, "feedback-sources"),
      icon: <ShapesIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      href: workspaceSettingsPath(workspaceId, "integrations"),
      icon: <BlocksIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "look",
      label: t("common.appearance"),
      href: workspaceSettingsPath(workspaceId, "look"),
      icon: <BrushIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "user-actions",
      label: t("common.user_actions"),
      href: workspaceSettingsPath(workspaceId, "user-actions"),
      icon: <ListChecksIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "tags",
      label: t("common.tags"),
      href: workspaceSettingsPath(workspaceId, "tags"),
      icon: <TagIcon className={iconClassName} />,
      disabled: isBilling,
    },
  ];

  const organizationItems: NavItem[] = [
    {
      id: "org-general",
      label: t("common.general"),
      href: organizationSettingsPath(organizationId, "general"),
      icon: <Building2Icon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "org-teams",
      label: t("common.teams"),
      href: organizationSettingsPath(organizationId, "teams"),
      icon: <UsersIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "org-feedback-directories",
      label: t("workspace.settings.feedback_directories.nav_label"),
      href: organizationSettingsPath(organizationId, "feedback-directories"),
      icon: <FoldersIcon className={iconClassName} />,
      hidden: isMember,
      disabled: !isOwnerOrManager,
    },
    {
      id: "org-api-keys",
      label: t("common.api_keys"),
      href: organizationSettingsPath(organizationId, "api-keys"),
      icon: <KeyIcon className={iconClassName} />,
      hidden: !isOwnerOrManager,
    },
    {
      id: "org-domain",
      label: t("common.domain"),
      href: organizationSettingsPath(organizationId, "domain"),
      icon: <GlobeIcon className={iconClassName} />,
      hidden: isFormbricksCloud,
    },
    {
      id: "org-billing",
      label: t("common.billing"),
      href: organizationSettingsPath(organizationId, "billing"),
      icon: <CreditCardIcon className={iconClassName} />,
      hidden: !isFormbricksCloud,
    },
    {
      id: "org-enterprise",
      label: t("common.enterprise_license"),
      href: organizationSettingsPath(organizationId, "enterprise"),
      icon: <ShieldIcon className={iconClassName} />,
      hidden: isFormbricksCloud,
      disabled: isMember || isBilling,
    },
  ];

  const accountItems: NavItem[] = [
    {
      id: "profile",
      label: t("common.your_profile"),
      href: accountSettingsPath("profile"),
      icon: <UserCircleIcon className={iconClassName} />,
    },
    {
      id: "notifications",
      label: t("common.notifications"),
      href: accountSettingsPath("notifications"),
      icon: <BellIcon className={iconClassName} />,
      disabled: isBilling,
    },
    {
      id: "authorized-apps",
      label: t("common.authorized_apps"),
      href: accountSettingsPath("authorized-apps"),
      icon: <UnplugIcon className={iconClassName} />,
      disabled: isBilling,
    },
  ];

  const disabledMessage = t("common.you_are_not_authorized_to_perform_this_action");

  const renderSection = (items: NavItem[]) => {
    const visibleItems = items.filter((item) => !item.hidden);
    return (
      <ul className="space-y-0.5">
        {visibleItems.map((item) => (
          <SettingsNavLink
            key={item.id}
            item={item}
            isActive={pathname.includes(item.href)}
            isCollapsed={isCollapsed}
            isTextVisible={isTextVisible}
            disabledMessage={item.disabled ? disabledMessage : undefined}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col overflow-y-auto">
      {!hideWorkspaceSection && (
        <div>
          <SectionHeader
            label={t("common.workspace")}
            isCollapsed={isCollapsed}
            isTextVisible={isTextVisible}
            switcherName={workspaceName}
            switcherItems={workspaces}
            isLoadingSwitcher={isLoadingWorkspaces}
            errorSwitcher={errorWorkspaces}
            onSwitcherRetry={onWorkspaceRetry}
            currentId={workspaceId}
            onSwitcherChange={onWorkspaceChange}
            onSwitcherOpen={onWorkspaceDropdownOpen}
          />
          {renderSection(workspaceItems)}
        </div>
      )}

      <div>
        <SectionHeader
          label={t("common.organization")}
          isCollapsed={isCollapsed}
          isTextVisible={isTextVisible}
          switcherName={organizationName}
          switcherItems={organizations}
          isLoadingSwitcher={isLoadingOrganizations}
          errorSwitcher={errorOrganizations}
          onSwitcherRetry={onOrganizationRetry}
          currentId={organizationId}
          onSwitcherChange={onOrganizationChange}
          onSwitcherOpen={onOrganizationDropdownOpen}
        />
        {renderSection(organizationItems)}
      </div>

      <div>
        <SectionHeader label={t("common.account")} isCollapsed={isCollapsed} isTextVisible={isTextVisible} />
        {renderSection(accountItems)}
      </div>
    </div>
  );
};
