"use client";

import { EnvironmentBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/environment-breadcrumb";
import { OrganizationBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/organization-breadcrumb";
import { ProjectBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/project-breadcrumb";
import { Breadcrumb, BreadcrumbList } from "@/modules/ui/components/breadcrumb";

interface ProjectAndOrgSwitchProps {
  currentOrganizationId: string;
  currentProjectId?: string;
  currentEnvironmentId?: string;
  environments: { id: string; type: string }[];
  // Removed: organizations prop (lazy-loaded)
  // Removed: projects prop (lazy-loaded)
  isMultiOrgEnabled: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isMember: boolean;
  isAccessControlAllowed: boolean;
}

export const ProjectAndOrgSwitch = ({
  currentOrganizationId,
  currentProjectId,
  currentEnvironmentId,
  environments,
  isMultiOrgEnabled,
  organizationProjectsLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  isMember,
}: ProjectAndOrgSwitchProps) => {
  const currentEnvironment = environments.find((env) => env.id === currentEnvironmentId);
  const showEnvironmentBreadcrumb = currentEnvironment?.type === "development";

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-0">
        <OrganizationBreadcrumb
          currentOrganizationId={currentOrganizationId}
          currentEnvironmentId={currentEnvironmentId}
          isMultiOrgEnabled={isMultiOrgEnabled}
          isFormbricksCloud={isFormbricksCloud}
          isMember={isMember}
          isOwnerOrManager={isOwnerOrManager}
        />
        {currentProjectId && currentEnvironmentId && (
          <ProjectBreadcrumb
            currentProjectId={currentProjectId}
            currentOrganizationId={currentOrganizationId}
            currentEnvironmentId={currentEnvironmentId}
            isOwnerOrManager={isOwnerOrManager}
            organizationProjectsLimit={organizationProjectsLimit}
            isFormbricksCloud={isFormbricksCloud}
            isLicenseActive={isLicenseActive}
            isAccessControlAllowed={isAccessControlAllowed}
            isEnvironmentBreadcrumbVisible={showEnvironmentBreadcrumb}
          />
        )}
        {showEnvironmentBreadcrumb && (
          <EnvironmentBreadcrumb environments={environments} currentEnvironment={currentEnvironment} />
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
