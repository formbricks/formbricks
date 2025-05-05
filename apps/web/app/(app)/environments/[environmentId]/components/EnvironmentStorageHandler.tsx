"use client";

import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { useEffect } from "react";

interface EnvironmentStorageHandlerProps {
  environmentId: string;
}

const EnvironmentStorageHandler = ({ environmentId }: EnvironmentStorageHandlerProps) => {
  // [UseTusk]

  useEffect(() => {
    localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, environmentId);
  }, [environmentId]);

  return null;
};

export default EnvironmentStorageHandler;
