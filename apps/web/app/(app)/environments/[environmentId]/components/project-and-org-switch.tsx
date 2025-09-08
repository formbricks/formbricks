"use client";

import { EnvironmentBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/environment-breadcrumb";
import { OrganizationBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/organization-breadcrumb";
import { ProjectBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/project-breadcrumb";
import { Breadcrumb, BreadcrumbList } from "@/modules/ui/components/breadcrumb";
import { useMemo } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";

interface ProjectAndOrgSwitchProps {
  currentOrganization: TOrganization;
  organizations: TOrganization[];
  currentProject?: TProject;
  projects: TProject[];
  currentEnvironment?: TEnvironment;
  environments: TEnvironment[];
  isMultiOrgEnabled: boolean;
  organizationProjectsLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isAccessControlAllowed: boolean;
  isMember: boolean;
}

export const ProjectAndOrgSwitch = ({
  currentOrganization,
  organizations,
  currentProject,
  projects,
  currentEnvironment,
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

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-0">
        <OrganizationBreadcrumb
          currentOrganization={currentOrganization}
          organizations={sortedOrganizations}
          isMultiOrgEnabled={isMultiOrgEnabled}
          currentEnvironmentId={currentEnvironment?.id}
          isFormbricksCloud={isFormbricksCloud}
          isMember={isMember}
          isOwnerOrManager={isOwnerOrManager}
        />
        {currentProject && currentEnvironment && (
          <ProjectBreadcrumb
            currentProject={currentProject}
            projects={sortedProjects}
            isOwnerOrManager={isOwnerOrManager}
            organizationProjectsLimit={organizationProjectsLimit}
            isFormbricksCloud={isFormbricksCloud}
            isLicenseActive={isLicenseActive}
            currentOrganization={currentOrganization}
            currentEnvironmentId={currentEnvironment.id}
            isAccessControlAllowed={isAccessControlAllowed}
          />
        )}
        {currentEnvironment && (
          <EnvironmentBreadcrumb environments={environments} environment={currentEnvironment} />
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
