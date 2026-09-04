"use client";

import { createContext, useContext, useMemo } from "react";
import { TOrganization } from "@formbricks/types/organizations";
import { TWorkspace } from "@formbricks/types/workspace";
import type { TDeploymentInfo } from "@/lib/ai/availability";

export interface WorkspaceContextType {
  workspace: TWorkspace;
  organization: TOrganization;
  organizationId: string;
  deployment: TDeploymentInfo;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within a WorkspaceContextWrapper");
  }
  return context;
};

// Like useWorkspaceContext but returns null instead of throwing when used outside
// a WorkspaceContextWrapper (e.g. the zero-workspaces landing page).
export const useOptionalWorkspaceContext = () => useContext(WorkspaceContext);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    return { workspace: null };
  }
  return { workspace: context.workspace };
};

/**
 * Deployment facts (cloud vs self-hosted, licence request URL) that client components need to point
 * an upgrade CTA at the right place. Returns null outside the provider, where the caller has no
 * workspace to upgrade and should render no CTA.
 */
export const useDeploymentInfo = (): TDeploymentInfo | null =>
  useContext(WorkspaceContext)?.deployment ?? null;

export const useOrganization = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    return { organization: null };
  }
  return { organization: context.organization };
};

// Client wrapper component to be used in server components
interface WorkspaceContextWrapperProps {
  workspace: TWorkspace;
  organization: TOrganization;
  deployment: TDeploymentInfo;
  children: React.ReactNode;
}

export const WorkspaceContextWrapper = ({
  workspace,
  organization,
  deployment,
  children,
}: Readonly<WorkspaceContextWrapperProps>) => {
  const workspaceContextValue = useMemo(
    () => ({
      workspace,
      organization,
      organizationId: workspace.organizationId,
      deployment,
    }),
    [workspace, organization, deployment]
  );

  return <WorkspaceContext.Provider value={workspaceContextValue}>{children}</WorkspaceContext.Provider>;
};
