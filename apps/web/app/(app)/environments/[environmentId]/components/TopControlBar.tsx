"use client";

import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { WorkspaceAndOrgSwitch } from "@/app/(app)/environments/[environmentId]/components/workspace-and-org-switch";
import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { getAccessFlags } from "@/lib/membership/utils";

interface TopControlBarProps {
  environments: TEnvironment[];
  currentOrganizationId: string;
  currentWorkspaceId: string;
  isMultiOrgEnabled: boolean;
  organizationWorkspacesLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isAccessControlAllowed: boolean;
  membershipRole?: TOrganizationRole;
}

export const TopControlBar = ({
  environments,
  currentOrganizationId,
  currentWorkspaceId,
  isMultiOrgEnabled,
  organizationWorkspacesLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  membershipRole,
}: TopControlBarProps) => {
  const { isMember } = getAccessFlags(membershipRole);
  const { environment } = useEnvironment();

  return (
    <div
      className="flex h-14 w-full items-center justify-between bg-slate-50 px-6"
      data-testid="fb__global-top-control-bar">
      <WorkspaceAndOrgSwitch
        currentEnvironmentId={environment.id}
        environments={environments}
        currentOrganizationId={currentOrganizationId}
        currentWorkspaceId={currentWorkspaceId}
        isMultiOrgEnabled={isMultiOrgEnabled}
        organizationWorkspacesLimit={organizationWorkspacesLimit}
        isFormbricksCloud={isFormbricksCloud}
        isLicenseActive={isLicenseActive}
        isOwnerOrManager={isOwnerOrManager}
        isMember={isMember}
        isAccessControlAllowed={isAccessControlAllowed}
      />
    </div>
  );
};
