"use client";

import { useEffect } from "react";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@formbricks/lib/localStorage";

interface EnvironmentStorageHandlerProps {
  environmentId: string;
}

const EnvironmentStorageHandler = ({ environmentId }: EnvironmentStorageHandlerProps) => {
  useEffect(() => {
    localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, environmentId);
  }, [environmentId]);

  return null;
};

export default EnvironmentStorageHandler;
