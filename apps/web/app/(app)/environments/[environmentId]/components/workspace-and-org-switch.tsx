"use client";

import { EnvironmentBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/environment-breadcrumb";
import { OrganizationBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/organization-breadcrumb";
import { WorkspaceBreadcrumb } from "@/app/(app)/environments/[environmentId]/components/workspace-breadcrumb";
import { Breadcrumb, BreadcrumbList } from "@/modules/ui/components/breadcrumb";

interface WorkspaceAndOrgSwitchProps {
  currentOrganizationId: string;
  currentOrganizationName?: string; // Optional: for pages without context
  currentWorkspaceId?: string;
  currentWorkspaceName?: string; // Optional: for pages without context
  currentEnvironmentId?: string;
  environments: { id: string; type: string }[];
  isMultiOrgEnabled: boolean;
  organizationWorkspacesLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isMember: boolean;
  isAccessControlAllowed: boolean;
}

export const WorkspaceAndOrgSwitch = ({
  currentOrganizationId,
  currentOrganizationName,
  currentWorkspaceId,
  currentWorkspaceName,
  currentEnvironmentId,
  environments,
  isMultiOrgEnabled,
  organizationWorkspacesLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  isMember,
}: WorkspaceAndOrgSwitchProps) => {
  const currentEnvironment = environments.find((env) => env.id === currentEnvironmentId);
  const showEnvironmentBreadcrumb = currentEnvironment?.type === "development";

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-0">
        <OrganizationBreadcrumb
          currentOrganizationId={currentOrganizationId}
          currentOrganizationName={currentOrganizationName}
          currentEnvironmentId={currentEnvironmentId}
          isMultiOrgEnabled={isMultiOrgEnabled}
          isFormbricksCloud={isFormbricksCloud}
          isMember={isMember}
          isOwnerOrManager={isOwnerOrManager}
        />
        {currentWorkspaceId && currentEnvironmentId && (
          <WorkspaceBreadcrumb
            currentWorkspaceId={currentWorkspaceId}
            currentWorkspaceName={currentWorkspaceName}
            currentOrganizationId={currentOrganizationId}
            currentEnvironmentId={currentEnvironmentId}
            isOwnerOrManager={isOwnerOrManager}
            organizationWorkspacesLimit={organizationWorkspacesLimit}
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
