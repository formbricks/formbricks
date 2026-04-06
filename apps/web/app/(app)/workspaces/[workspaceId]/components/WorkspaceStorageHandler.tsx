"use client";

import { useEffect } from "react";
import { FORMBRICKS_ENVIRONMENT_ID_LS, FORMBRICKS_WORKSPACE_ID_LS } from "@/lib/localStorage";

interface WorkspaceStorageHandlerProps {
  workspaceId: string;
  environmentId: string;
}

const WorkspaceStorageHandler = ({ workspaceId, environmentId }: WorkspaceStorageHandlerProps) => {
  useEffect(() => {
    localStorage.setItem(FORMBRICKS_WORKSPACE_ID_LS, workspaceId);
    // Keep environment ID in sync for backward compatibility with old SDK clients
    localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, environmentId);
  }, [workspaceId, environmentId]);

  return null;
};

export default WorkspaceStorageHandler;
