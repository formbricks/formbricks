"use client";

import { EnvironmentBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/environment-breadcrumb";
import { OrganizationBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/organization-breadcrumb";
import { ProjectBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/project-breadcrumb";
import { Breadcrumb, BreadcrumbList } from "@/modules/ui/components/breadcrumb";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";

interface ProjectAndOrgSwitchProps {
  currentOrganization: TOrganization;
  organizations: TOrganization[];
  currentProject: TProject;
  projects: TProject[];
  currentEnvironment: TEnvironment;
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
  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-0">
        <OrganizationBreadcrumb
          currentOrganization={currentOrganization}
          organizations={organizations}
          isMultiOrgEnabled={isMultiOrgEnabled}
          currentEnvironmentId={currentEnvironment.id}
          isFormbricksCloud={isFormbricksCloud}
          isMember={isMember}
        />
        <ProjectBreadcrumb
          currentProject={currentProject}
          projects={projects}
          isOwnerOrManager={isOwnerOrManager}
          organizationProjectsLimit={organizationProjectsLimit}
          isFormbricksCloud={isFormbricksCloud}
          isLicenseActive={isLicenseActive}
          currentOrganization={currentOrganization}
          currentEnvironmentId={currentEnvironment.id}
          isAccessControlAllowed={isAccessControlAllowed}
        />
        <EnvironmentBreadcrumb environments={environments} environment={currentEnvironment} />
      </BreadcrumbList>
    </Breadcrumb>
  );
};
