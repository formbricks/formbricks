"use client";

import {
  BlocksIcon,
  BrushIcon,
  FoldersIcon,
  LanguagesIcon,
  ListChecksIcon,
  TagIcon,
  UnplugIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAccessFlags } from "@/lib/membership/utils";
import {
  OrganizationAndAccountSections,
  type OrganizationAndAccountSectionsProps,
} from "@/modules/settings/components/sidebar/organization-and-account-sections";
import { SettingsNavSection } from "@/modules/settings/components/sidebar/settings-nav-section";
import { SettingsSectionHeader } from "@/modules/settings/components/sidebar/settings-section-header";
import type { NavItem } from "@/modules/settings/components/sidebar/types";
import { workspaceSettingsPath } from "@/modules/settings/lib/routes";

interface WorkspaceSettingsSidebarProps extends OrganizationAndAccountSectionsProps {
  workspaceId: string;
  workspaceName: string;
  // Workspace switcher
  workspaces: { id: string; name: string }[];
  isLoadingWorkspaces: boolean;
  onWorkspaceChange: (id: string) => void;
  onWorkspaceDropdownOpen: () => void;
  errorWorkspaces?: string | null;
  onWorkspaceRetry?: () => void;
}

// The settings sidebar for workspace-scoped routes (/workspaces/[workspaceId]/settings/**). Those
// routes always know their workspace, so every piece of workspace data is required here — there is no
// "hide the workspace section" mode. The workspace-agnostic routes render OrganizationSettingsSidebar
// instead, and both end with the same OrganizationAndAccountSections.
export const WorkspaceSettingsSidebar = (props: Readonly<WorkspaceSettingsSidebarProps>) => {
  const {
    workspaceId,
    workspaceName,
    workspaces,
    isLoadingWorkspaces,
    onWorkspaceChange,
    onWorkspaceDropdownOpen,
    errorWorkspaces,
    onWorkspaceRetry,
    ...organizationAndAccountProps
  } = props;
  const { membershipRole, isCollapsed, isTextVisible } = organizationAndAccountProps;

  const { t } = useTranslation();
  const { isBilling } = getAccessFlags(membershipRole);
  const iconClassName = "h-4 w-4 shrink-0";

  // Workspace items stay nested under the workspace. Paths come from the shared route helpers so they
  // can't drift from redirects/other navigation.
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

  return (
    <div className="flex flex-col overflow-y-auto">
      <div>
        <SettingsSectionHeader
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
        <SettingsNavSection items={workspaceItems} isCollapsed={isCollapsed} isTextVisible={isTextVisible} />
      </div>

      <OrganizationAndAccountSections {...organizationAndAccountProps} />
    </div>
  );
};
