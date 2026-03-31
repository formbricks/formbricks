"use client";

import { createContext, useContext, useMemo } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TWorkspace } from "@formbricks/types/workspace";

export interface EnvironmentContextType {
  environment: TEnvironment;
  workspace: TWorkspace;
  organization: TOrganization;
  organizationId: string;
}

const EnvironmentContext = createContext<EnvironmentContextType | null>(null);

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
};

export const useWorkspace = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    return { workspace: null };
  }
  return { workspace: context.workspace };
};

export const useOrganization = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    return { organization: null };
  }
  return { organization: context.organization };
};

// Client wrapper component to be used in server components
interface EnvironmentContextWrapperProps {
  environment: TEnvironment;
  workspace: TWorkspace;
  organization: TOrganization;
  children: React.ReactNode;
}

export const EnvironmentContextWrapper = ({
  environment,
  workspace,
  organization,
  children,
}: EnvironmentContextWrapperProps) => {
  const environmentContextValue = useMemo(
    () => ({
      environment,
      workspace,
      organization,
      organizationId: workspace.organizationId,
    }),
    [environment, workspace, organization]
  );

  return (
    <EnvironmentContext.Provider value={environmentContextValue}>{children}</EnvironmentContext.Provider>
  );
};
