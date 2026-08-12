"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import type { TUser } from "@formbricks/types/user";
import { getOrganizationsForSwitcherAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import { OrganizationSettingsSidebar } from "@/modules/settings/components/sidebar/organization-settings-sidebar";
import { UserDropdown } from "@/modules/settings/components/user-dropdown";
import { useSwitcherData } from "@/modules/settings/hooks/use-switcher-data";
import { GoBackButton } from "@/modules/ui/components/go-back-button";

interface SettingsNavigationProps {
  user: TUser;
  organizationId: string;
  organizationName: string;
  membershipRole?: TOrganizationRole;
  isFormbricksCloud: boolean;
  publicDomain: string;
  isFormbricksSurveysConfigured: boolean;
  // Where the back arrow returns to (the surveys list of the current workspace).
  backUrl: string;
}

// The settings-mode sidebar chrome for the workspace-agnostic settings routes
// (/organizations/[organizationId]/settings and /account/settings). It renders
// OrganizationSettingsSidebar, which shares its Organization and Account sections with the
// in-workspace sidebar (MainNavigation -> WorkspaceSettingsSidebar) but has no Workspace section:
// these routes carry no workspaceId, and the top bar breadcrumb is where workspaces get switched.
export const SettingsNavigation = ({
  user,
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

  const organizationSwitcher = useSwitcherData(
    () => getOrganizationsForSwitcherAction({ organizationId }),
    t("common.failed_to_load_organizations")
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
        <OrganizationSettingsSidebar
          organizationId={organizationId}
          organizationName={organizationName}
          membershipRole={membershipRole}
          isFormbricksCloud={isFormbricksCloud}
          isCollapsed={false}
          isTextVisible={false}
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
