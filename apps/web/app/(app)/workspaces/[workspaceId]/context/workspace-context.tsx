"use client";

import { createContext, useContext, useMemo } from "react";
import { TOrganization } from "@formbricks/types/organizations";
import { TWorkspace } from "@formbricks/types/workspace";

export interface WorkspaceContextType {
  workspace: TWorkspace;
  organization: TOrganization;
  organizationId: string;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within a WorkspaceContextWrapper");
  }
  return context;
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    return { workspace: null };
  }
  return { workspace: context.workspace };
};

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
  children: React.ReactNode;
}

export const WorkspaceContextWrapper = ({
  workspace,
  organization,
  children,
}: WorkspaceContextWrapperProps) => {
  const workspaceContextValue = useMemo(
    () => ({
      workspace,
      organization,
      organizationId: workspace.organizationId,
    }),
    [workspace, organization]
  );

  return <WorkspaceContext.Provider value={workspaceContextValue}>{children}</WorkspaceContext.Provider>;
};
