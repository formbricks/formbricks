"use client";

import {
  BellIcon,
  Building2Icon,
  CreditCardIcon,
  FoldersIcon,
  GlobeIcon,
  KeyIcon,
  ShieldIcon,
  UnplugIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { SettingsNavSection } from "@/modules/settings/components/sidebar/settings-nav-section";
import { SettingsSectionHeader } from "@/modules/settings/components/sidebar/settings-section-header";
import type { NavItem } from "@/modules/settings/components/sidebar/types";
import { accountSettingsPath, organizationSettingsPath } from "@/modules/settings/lib/routes";

export interface OrganizationAndAccountSectionsProps {
  organizationId: string;
  organizationName: string;
  membershipRole?: TOrganizationRole;
  isFormbricksCloud: boolean;
  isCollapsed: boolean;
  isTextVisible: boolean;
  // Organization switcher
  organizations: { id: string; name: string }[];
  isLoadingOrganizations: boolean;
  onOrganizationChange: (id: string) => void;
  onOrganizationDropdownOpen: () => void;
  errorOrganizations?: string | null;
  onOrganizationRetry?: () => void;
}

// The tail every settings sidebar ends with: organization settings (with their switcher pill) followed
// by account settings. Both are workspace-agnostic — they live on their own top-level routes and work
// with or without a current workspace — so the workspace-scoped and workspace-agnostic sidebars render
// this same component instead of each keeping their own copy of the item lists.
export const OrganizationAndAccountSections = ({
  organizationId,
  organizationName,
  membershipRole,
  isFormbricksCloud,
  isCollapsed,
  isTextVisible,
  organizations,
  isLoadingOrganizations,
  onOrganizationChange,
  onOrganizationDropdownOpen,
  errorOrganizations,
  onOrganizationRetry,
}: Readonly<OrganizationAndAccountSectionsProps>) => {
  const { t } = useTranslation();
  const { isMember, isBilling, isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const iconClassName = "h-4 w-4 shrink-0";

  // Paths come from the shared route helpers so they can't drift from redirects/other navigation.
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
      id: "org-api-keys",
      label: t("common.api_keys"),
      href: organizationSettingsPath(organizationId, "api-keys"),
      icon: <KeyIcon className={iconClassName} />,
      hidden: !isOwnerOrManager,
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

  return (
    <>
      <div>
        <SettingsSectionHeader
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
        <SettingsNavSection
          items={organizationItems}
          isCollapsed={isCollapsed}
          isTextVisible={isTextVisible}
        />
      </div>

      <div>
        <SettingsSectionHeader
          label={t("common.account")}
          isCollapsed={isCollapsed}
          isTextVisible={isTextVisible}
        />
        <SettingsNavSection items={accountItems} isCollapsed={isCollapsed} isTextVisible={isTextVisible} />
      </div>
    </>
  );
};
