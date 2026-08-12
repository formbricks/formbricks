"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import type { TUser } from "@formbricks/types/user";
import {
  getOrganizationsForSwitcherAction,
  getWorkspacesForSwitcherAction,
} from "@/app/(app)/workspaces/[workspaceId]/actions";
import { SettingsSidebarContent } from "@/app/(app)/workspaces/[workspaceId]/components/SettingsSidebarContent";
import { UserDropdown } from "@/modules/settings/components/user-dropdown";
import { useSwitcherData } from "@/modules/settings/hooks/use-switcher-data";
import { GoBackButton } from "@/modules/ui/components/go-back-button";

interface SettingsNavigationProps {
  user: TUser;
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  membershipRole?: TOrganizationRole;
  isFormbricksCloud: boolean;
  publicDomain: string;
  isFormbricksSurveysConfigured: boolean;
  // Where the back arrow returns to (the surveys list of the current workspace).
  backUrl: string;
}

// The settings-mode sidebar chrome, extracted so it can render both inside the workspace layout
// (MainNavigation) and on the standalone /organizations/[id]/settings and /account/settings routes —
// one component, identical UI, regardless of which scoped route is active.
export const SettingsNavigation = ({
  user,
  workspaceId,
  workspaceName,
  organizationId,
  organizationName,
  membershipRole,
  isFormbricksCloud,
  publicDomain,
  isFormbricksSurveysConfigured,
  backUrl,
}: Readonly<SettingsNavigationProps>) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [, startTransition] = useTransition();

  const workspaceSwitcher = useSwitcherData(
    () => getWorkspacesForSwitcherAction({ organizationId }),
    t("common.failed_to_load_workspaces")
  );
  const organizationSwitcher = useSwitcherData(
    () => getOrganizationsForSwitcherAction({ organizationId }),
    t("common.failed_to_load_organizations")
  );

  const handleWorkspaceChange = useCallback(
    (id: string) => {
      startTransition(() => {
        router.push(`/workspaces/${id}/settings/workspace/general`);
      });
    },
    [router]
  );

  const handleOrganizationChange = useCallback(
    (id: string) => {
      startTransition(() => {
        router.push(
          id === organizationId ? `/organizations/${id}/settings/general` : `/organizations/${id}/`
        );
      });
    },
    [router, organizationId]
  );

  return (
    <aside className="z-40 flex w-sidebar-collapsed flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100">
      <div className="flex flex-col overflow-hidden">
        <div className="mb-2 px-3">
          <GoBackButton url={backUrl} />
        </div>
        <SettingsSidebarContent
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          organizationId={organizationId}
          organizationName={organizationName}
          membershipRole={membershipRole}
          isFormbricksCloud={isFormbricksCloud}
          isCollapsed={false}
          isTextVisible={false}
          hideWorkspaceSection={!workspaceId}
          workspaces={workspaceSwitcher.items}
          isLoadingWorkspaces={workspaceSwitcher.isLoading}
          onWorkspaceChange={handleWorkspaceChange}
          onWorkspaceDropdownOpen={() =>
            workspaceSwitcher.error ? workspaceSwitcher.retry() : workspaceSwitcher.load()
          }
          errorWorkspaces={workspaceSwitcher.error}
          onWorkspaceRetry={workspaceSwitcher.retry}
          organizations={organizationSwitcher.items}
          isLoadingOrganizations={organizationSwitcher.isLoading}
          onOrganizationChange={handleOrganizationChange}
          onOrganizationDropdownOpen={() =>
            organizationSwitcher.error ? organizationSwitcher.retry() : organizationSwitcher.load()
          }
          errorOrganizations={organizationSwitcher.error}
          onOrganizationRetry={organizationSwitcher.retry}
        />
      </div>
      <UserDropdown
        user={user}
        organizationId={organizationId}
        publicDomain={publicDomain}
        isFormbricksSurveysConfigured={isFormbricksSurveysConfigured}
      />
    </aside>
  );
};
