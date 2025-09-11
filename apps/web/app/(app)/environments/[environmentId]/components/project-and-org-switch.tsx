"use client";

import { EnvironmentBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/environment-breadcrumb";
import { OrganizationBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/organization-breadcrumb";
import { ProjectBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/project-breadcrumb";
import { Breadcrumb, BreadcrumbList } from "@/modules/ui/components/breadcrumb";
import { useMemo } from "react";

interface ProjectAndOrgSwitchProps {
  currentOrganizationId: string;
  organizations: { id: string; name: string }[];
  currentProjectId?: string;
  projects: { id: string; name: string }[];
  currentEnvironmentId?: string;
  environments: { id: string; type: string }[];
  isMultiOrgEnabled: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isAccessControlAllowed: boolean;
  isMember: boolean;
}

export const ProjectAndOrgSwitch = ({
  currentOrganizationId,
  organizations,
  currentProjectId,
  projects,
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
  const sortedProjects = useMemo(() => projects.toSorted((a, b) => a.name.localeCompare(b.name)), [projects]);
  const sortedOrganizations = useMemo(
    () => organizations.toSorted((a, b) => a.name.localeCompare(b.name)),
    [organizations]
  );
  const currentEnvironment = environments.find((env) => env.id === currentEnvironmentId);
  const showEnvironmentBreadcrumb = currentEnvironment?.type === "development";

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-0">
        <OrganizationBreadcrumb
          currentOrganizationId={currentOrganizationId}
          organizations={sortedOrganizations}
          isMultiOrgEnabled={isMultiOrgEnabled}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={isFormbricksCloud}
          isMember={isMember}
          isOwnerOrManager={isOwnerOrManager}
        />
        {currentProjectId && currentEnvironmentId && (
          <ProjectBreadcrumb
            currentProjectId={currentProjectId}
            currentOrganizationId={currentOrganizationId}
            currentEnvironmentId={currentEnvironmentId}
            projects={sortedProjects}
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
