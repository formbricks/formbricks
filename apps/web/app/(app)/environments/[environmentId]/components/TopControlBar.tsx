"use client";

import { ProjectAndOrgSwitch } from "@/app/(app)/environments/[environmentId]/components/project-and-org-switch";
import { useEnvironment } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { getAccessFlags } from "@/lib/membership/utils";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TopControlBarProps {
  environments: TEnvironment[];
  currentOrganizationId: string;
  organizations: { id: string; name: string }[];
  currentProjectId: string;
  projects: { id: string; name: string }[];
  isMultiOrgEnabled: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isAccessControlAllowed: boolean;
  membershipRole?: TOrganizationRole;
}

export const TopControlBar = ({
  environments,
  currentOrganizationId,
  organizations,
  currentProjectId,
  projects,
  isMultiOrgEnabled,
  organizationProjectsLimit,
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
      <ProjectAndOrgSwitch
        currentEnvironmentId={environment.id}
        environments={environments}
        currentOrganizationId={currentOrganizationId}
        organizations={organizations}
        currentProjectId={currentProjectId}
        projects={projects}
        isMultiOrgEnabled={isMultiOrgEnabled}
        organizationProjectsLimit={organizationProjectsLimit}
        isFormbricksCloud={isFormbricksCloud}
        isLicenseActive={isLicenseActive}
        isOwnerOrManager={isOwnerOrManager}
        isMember={isMember}
        isAccessControlAllowed={isAccessControlAllowed}
      />
    </div>
  );
};
