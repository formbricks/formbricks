"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import {
  getOrganizationsForSwitcherAction,
  getWorkspacesForSwitcherAction,
} from "@/app/(app)/workspaces/[workspaceId]/actions";
import { SettingsSidebarContent } from "@/app/(app)/workspaces/[workspaceId]/components/SettingsSidebarContent";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { GoBackButton } from "@/modules/ui/components/go-back-button";

interface SettingsNavigationProps {
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  membershipRole?: TOrganizationRole;
  isFormbricksCloud: boolean;
  // Where the back arrow returns to (the surveys list of the current workspace).
  backUrl: string;
}

// The settings-mode sidebar chrome, extracted so it can render both inside the workspace layout
// (MainNavigation) and on the standalone /organizations/[id]/settings and /account/settings routes —
// one component, identical UI, regardless of which scoped route is active.
export const SettingsNavigation = ({
  workspaceId,
  workspaceName,
  organizationId,
  organizationName,
  membershipRole,
  isFormbricksCloud,
  backUrl,
}: Readonly<SettingsNavigationProps>) => {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    if (workspaces.length > 0 || isLoadingWorkspaces) return;
    setIsLoadingWorkspaces(true);
    try {
      const result = await getWorkspacesForSwitcherAction({ organizationId });
      if (result?.data) {
        setWorkspaces([...result.data].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        getFormattedErrorMessage(result);
      }
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [organizationId, workspaces.length, isLoadingWorkspaces]);

  const loadOrganizations = useCallback(async () => {
    if (organizations.length > 0 || isLoadingOrganizations) return;
    setIsLoadingOrganizations(true);
    try {
      const result = await getOrganizationsForSwitcherAction({ organizationId });
      if (result?.data) {
        setOrganizations([...result.data].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        getFormattedErrorMessage(result);
      }
    } finally {
      setIsLoadingOrganizations(false);
    }
  }, [organizationId, organizations.length, isLoadingOrganizations]);

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
          workspaces={workspaces}
          isLoadingWorkspaces={isLoadingWorkspaces}
          onWorkspaceChange={handleWorkspaceChange}
          onWorkspaceDropdownOpen={loadWorkspaces}
          organizations={organizations}
          isLoadingOrganizations={isLoadingOrganizations}
          onOrganizationChange={handleOrganizationChange}
          onOrganizationDropdownOpen={loadOrganizations}
        />
      </div>
    </aside>
  );
};
