"use client";

import { TOrganizationRole } from "@formbricks/types/memberships";
import { WorkspaceAndOrgSwitch } from "@/app/(app)/workspaces/[workspaceId]/components/workspace-and-org-switch";
import { useWorkspaceContext } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getAccessFlags } from "@/lib/membership/utils";

interface TopControlBarProps {
  currentOrganizationId: string;
  isMultiOrgEnabled: boolean;
  organizationWorkspacesLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isAccessControlAllowed: boolean;
  membershipRole?: TOrganizationRole;
}

export const TopControlBar = ({
  currentOrganizationId,
  isMultiOrgEnabled,
  organizationWorkspacesLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  membershipRole,
}: TopControlBarProps) => {
  const { isMember, isBilling } = getAccessFlags(membershipRole);
  const { workspace } = useWorkspaceContext();
  const isMembershipPending = membershipRole === undefined;

  return (
    <div
      className="flex h-14 w-full items-center justify-between bg-slate-50 px-6"
      data-testid="fb__global-top-control-bar">
      <WorkspaceAndOrgSwitch
        currentWorkspaceId={workspace.id}
        currentOrganizationId={currentOrganizationId}
        isMultiOrgEnabled={isMultiOrgEnabled}
        organizationWorkspacesLimit={organizationWorkspacesLimit}
        isFormbricksCloud={isFormbricksCloud}
        isLicenseActive={isLicenseActive}
        isOwnerOrManager={isOwnerOrManager}
        isMember={isMember}
        isBilling={isBilling}
        isMembershipPending={isMembershipPending}
        isAccessControlAllowed={isAccessControlAllowed}
      />
    </div>
  );
};
