"use client";

import { OrganizationBreadcrumb } from "@/app/(app)/workspaces/[workspaceId]/components/organization-breadcrumb";
import { WorkspaceBreadcrumb } from "@/app/(app)/workspaces/[workspaceId]/components/workspace-breadcrumb";
import { Breadcrumb, BreadcrumbList } from "@/modules/ui/components/breadcrumb";

interface WorkspaceAndOrgSwitchProps {
  currentOrganizationId: string;
  currentOrganizationName?: string; // Optional: for pages without context
  currentWorkspaceId?: string;
  currentWorkspaceName?: string; // Optional: for pages without context
  isMultiOrgEnabled: boolean;
  organizationWorkspacesLimit: number;
  isFormbricksCloud: boolean;
  isLicenseActive: boolean;
  isOwnerOrManager: boolean;
  isAccessControlAllowed: boolean;
  isMembershipPending: boolean;
  // Workspace-agnostic routes (/organizations/[organizationId]/settings, /account/settings) opt out:
  // there is no current workspace on those pages, so the breadcrumb must not claim one. The
  // organization breadcrumb still receives the resolved workspace id for its own menu.
  showWorkspaceBreadcrumb?: boolean;
}

export const WorkspaceAndOrgSwitch = ({
  currentOrganizationId,
  currentOrganizationName,
  currentWorkspaceId,
  currentWorkspaceName,
  isMultiOrgEnabled,
  organizationWorkspacesLimit,
  isFormbricksCloud,
  isLicenseActive,
  isOwnerOrManager,
  isAccessControlAllowed,
  isMembershipPending,
  showWorkspaceBreadcrumb = true,
}: Readonly<WorkspaceAndOrgSwitchProps>) => {
  // Keep this as the id itself rather than a boolean: rendering the workspace crumb narrows it to a
  // defined string, which a separate boolean flag would not do.
  const workspaceCrumbId = showWorkspaceBreadcrumb ? currentWorkspaceId : undefined;

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-0">
        <OrganizationBreadcrumb
          currentOrganizationId={currentOrganizationId}
          currentOrganizationName={currentOrganizationName}
          currentWorkspaceId={currentWorkspaceId}
          isMultiOrgEnabled={isMultiOrgEnabled}
          isLastCrumb={!workspaceCrumbId}
        />
        {workspaceCrumbId && (
          <WorkspaceBreadcrumb
            currentWorkspaceId={workspaceCrumbId}
            currentWorkspaceName={currentWorkspaceName}
            currentOrganizationId={currentOrganizationId}
            isOwnerOrManager={isOwnerOrManager}
            organizationWorkspacesLimit={organizationWorkspacesLimit}
            isFormbricksCloud={isFormbricksCloud}
            isLicenseActive={isLicenseActive}
            isAccessControlAllowed={isAccessControlAllowed}
            isEnvironmentBreadcrumbVisible={false}
            isMembershipPending={isMembershipPending}
          />
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
