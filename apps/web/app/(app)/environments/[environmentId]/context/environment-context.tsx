"use client";

import { createContext, useContext, useMemo } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";

export interface EnvironmentContextType {
  environment: TEnvironment;
  project: TProject;
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

export const useProject = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    return { project: null };
  }
  return { project: context.project };
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
  project: TProject;
  organization: TOrganization;
  children: React.ReactNode;
}

export const EnvironmentContextWrapper = ({
  environment,
  project,
  organization,
  children,
}: EnvironmentContextWrapperProps) => {
  const environmentContextValue = useMemo(
    () => ({
      environment,
      project,
      organization,
      organizationId: project.organizationId,
    }),
    [environment, project, organization]
  );

  return (
    <EnvironmentContext.Provider value={environmentContextValue}>{children}</EnvironmentContext.Provider>
  );
};
