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
  ShieldIcon,
  TagIcon,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface SettingsSidebarContentProps {
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  membershipRole?: TOrganizationRole;
  isFormbricksCloud: boolean;
  isCollapsed: boolean;
  isTextVisible: boolean;
  // Workspace switcher
  workspaces: { id: string; name: string }[];
  isLoadingWorkspaces: boolean;
  onWorkspaceChange: (id: string) => void;
  onWorkspaceDropdownOpen: () => void;
  // Organization switcher
  organizations: { id: string; name: string }[];
  isLoadingOrganizations: boolean;
  onOrganizationChange: (id: string) => void;
  onOrganizationDropdownOpen: () => void;
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
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  isTextVisible: boolean;
}) => {
  const activeClass = "bg-slate-50 border-r-4 border-brand-dark font-semibold text-slate-900";
  const inactiveClass =
    "hover:bg-slate-50 border-r-4 border-transparent hover:border-slate-300 transition-all duration-150 ease-in-out";

  if (isCollapsed) {
    return (
      <li className={cn("rounded-l-md py-1.5 pl-2 text-sm", isActive ? activeClass : inactiveClass)}>
        <Link href={item.href} className="flex items-center text-slate-600 hover:text-slate-900">
          {item.icon}
        </Link>
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
  icon,
  label,
  isCollapsed,
  isTextVisible,
  switcherName,
  switcherItems,
  isLoadingSwitcher,
  currentId,
  onSwitcherChange,
  onSwitcherOpen,
}: {
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  isTextVisible: boolean;
  switcherName?: string;
  switcherItems?: { id: string; name: string }[];
  isLoadingSwitcher?: boolean;
  currentId?: string;
  onSwitcherChange?: (id: string) => void;
  onSwitcherOpen?: () => void;
}) => {
  if (isCollapsed) {
    return <div className="mb-1 mt-3 flex justify-center px-2 text-slate-400">{icon}</div>;
  }

  return (
    <div
      className={cn(
        "mb-1 mt-4 flex min-w-0 items-center gap-2 px-3",
        isTextVisible ? "opacity-0" : "opacity-100"
      )}>
      <span className="text-slate-500">{icon}</span>
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {switcherName && switcherItems && onSwitcherChange && (
        <DropdownMenu onOpenChange={(open) => open && onSwitcherOpen?.()}>
          <DropdownMenuTrigger className="ml-auto flex min-w-0 max-w-[50%] items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">
            <span className="truncate">{switcherName}</span>
            <ChevronDownIcon className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[300px]">
            {isLoadingSwitcher ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
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
  workspaces,
  isLoadingWorkspaces,
  onWorkspaceChange,
  onWorkspaceDropdownOpen,
  organizations,
  isLoadingOrganizations,
  onOrganizationChange,
  onOrganizationDropdownOpen,
}: SettingsSidebarContentProps) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isMember, isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const iconClassName = "h-4 w-4 shrink-0";

  const basePath = `/workspaces/${workspaceId}/settings`;

  const workspaceItems: NavItem[] = [
    {
      id: "general",
      label: t("common.general"),
      href: `${basePath}/workspace/general`,
      icon: <FoldersIcon className={iconClassName} />,
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      href: `${basePath}/workspace/look`,
      icon: <BrushIcon className={iconClassName} />,
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      href: `${basePath}/workspace/app-connection`,
      icon: <ListChecksIcon className={iconClassName} />,
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      href: `${basePath}/workspace/integrations`,
      icon: <BlocksIcon className={iconClassName} />,
    },
    {
      id: "teams",
      label: t("common.team_access"),
      href: `${basePath}/workspace/teams`,
      icon: <UsersIcon className={iconClassName} />,
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      href: `${basePath}/workspace/languages`,
      icon: <LanguagesIcon className={iconClassName} />,
    },
    {
      id: "tags",
      label: t("common.tags"),
      href: `${basePath}/workspace/tags`,
      icon: <TagIcon className={iconClassName} />,
    },
  ];

  const organizationItems: NavItem[] = [
    {
      id: "org-general",
      label: t("common.general"),
      href: `${basePath}/organization/general`,
      icon: <Building2Icon className={iconClassName} />,
    },
    {
      id: "org-teams",
      label: t("common.members_and_teams"),
      href: `${basePath}/organization/teams`,
      icon: <UsersIcon className={iconClassName} />,
    },
    {
      id: "org-api-keys",
      label: t("common.api_keys"),
      href: `${basePath}/organization/api-keys`,
      icon: <KeyIcon className={iconClassName} />,
      hidden: !isOwnerOrManager,
    },
    {
      id: "org-domain",
      label: t("common.domain"),
      href: `${basePath}/organization/domain`,
      icon: <GlobeIcon className={iconClassName} />,
      hidden: isFormbricksCloud,
    },
    {
      id: "org-billing",
      label: t("common.billing"),
      href: `${basePath}/organization/billing`,
      icon: <CreditCardIcon className={iconClassName} />,
      hidden: !isFormbricksCloud,
    },
    {
      id: "org-enterprise",
      label: t("common.enterprise_license"),
      href: `${basePath}/organization/enterprise`,
      icon: <ShieldIcon className={iconClassName} />,
      hidden: isFormbricksCloud,
      disabled: isMember,
    },
  ];

  const accountItems: NavItem[] = [
    {
      id: "profile",
      label: t("common.profile"),
      href: `${basePath}/account/profile`,
      icon: <UserCircleIcon className={iconClassName} />,
    },
    {
      id: "notifications",
      label: t("common.notifications"),
      href: `${basePath}/account/notifications`,
      icon: <BellIcon className={iconClassName} />,
    },
  ];

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
          />
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      <SectionHeader
        icon={<FoldersIcon className="h-4 w-4" />}
        label={t("common.workspace")}
        isCollapsed={isCollapsed}
        isTextVisible={isTextVisible}
        switcherName={workspaceName}
        switcherItems={workspaces}
        isLoadingSwitcher={isLoadingWorkspaces}
        currentId={workspaceId}
        onSwitcherChange={onWorkspaceChange}
        onSwitcherOpen={onWorkspaceDropdownOpen}
      />
      {renderSection(workspaceItems)}

      <SectionHeader
        icon={<Building2Icon className="h-4 w-4" />}
        label={t("common.organization")}
        isCollapsed={isCollapsed}
        isTextVisible={isTextVisible}
        switcherName={organizationName}
        switcherItems={organizations}
        isLoadingSwitcher={isLoadingOrganizations}
        currentId={organizationId}
        onSwitcherChange={onOrganizationChange}
        onSwitcherOpen={onOrganizationDropdownOpen}
      />
      {renderSection(organizationItems)}

      <SectionHeader
        icon={<UserCircleIcon className="h-4 w-4" />}
        label={t("common.account")}
        isCollapsed={isCollapsed}
        isTextVisible={isTextVisible}
      />
      {renderSection(accountItems)}
    </div>
  );
};
