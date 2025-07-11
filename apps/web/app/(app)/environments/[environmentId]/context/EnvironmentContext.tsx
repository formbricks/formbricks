"use client";

import { createContext, useContext, useMemo } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TProject } from "@formbricks/types/project";

export interface EnvironmentContextType {
  environment: TEnvironment;
  project: TProject;
}

const EnvironmentContext = createContext<EnvironmentContextType | null>(null);

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
};

// Client wrapper component to be used in server components
interface EnvironmentContextWrapperProps {
  environment: TEnvironment;
  project: TProject;
  children: React.ReactNode;
}

export const EnvironmentContextWrapper = ({
  environment,
  project,
  children,
}: EnvironmentContextWrapperProps) => {
  const environmentContextValue = useMemo(
    () => ({
      environment,
      project,
    }),
    [environment, project]
  );

  return (
    <EnvironmentContext.Provider value={environmentContextValue}>{children}</EnvironmentContext.Provider>
  );
};
