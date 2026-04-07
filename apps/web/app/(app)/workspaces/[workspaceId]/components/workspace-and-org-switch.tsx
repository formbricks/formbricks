"use client";

import { OrganizationBreadcrumb } from "@/app/(app)/workspaces/[workspaceId]/components/organization-breadcrumb";
import { WorkspaceBreadcrumb } from "@/app/(app)/workspaces/[workspaceId]/components/workspace-breadcrumb";
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
  isMultiOrgEnabled,
  organizationWorkspacesLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  isMember,
}: WorkspaceAndOrgSwitchProps) => {
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
            isOwnerOrManager={isOwnerOrManager}
            organizationWorkspacesLimit={organizationWorkspacesLimit}
            isFormbricksCloud={isFormbricksCloud}
            isLicenseActive={isLicenseActive}
            isAccessControlAllowed={isAccessControlAllowed}
            isEnvironmentBreadcrumbVisible={false}
          />
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
