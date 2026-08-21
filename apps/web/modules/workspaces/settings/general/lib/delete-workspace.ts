import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getWorkspace } from "@/lib/workspace/service";
import { deleteWorkspaceIfNotLast } from "@/modules/workspaces/settings/lib/workspace";
import {
  WORKSPACE_DELETE_CONFIRMATION_ERROR,
  hasMatchingWorkspaceDeleteConfirmation,
} from "./delete-workspace-confirmation";

const ZWorkspaceDeleteAction = z.object({
  workspaceId: ZId,
  confirmationName: z.string().trim().min(1),
});

export const DELETE_WORKSPACE_CONFIRMATION_REQUIRED_ERROR =
  "Workspace name confirmation is required to delete this workspace.";

export const parseWorkspaceDeleteActionInput = (input: unknown) => {
  const parsedInput = ZWorkspaceDeleteAction.safeParse(input);

  if (!parsedInput.success) {
    throw new InvalidInputError(DELETE_WORKSPACE_CONFIRMATION_REQUIRED_ERROR);
  }

  return parsedInput.data;
};

export const getWorkspaceIdForLogging = (input: unknown) => {
  if (typeof input !== "object" || input === null || !("workspaceId" in input)) {
    return "unknown";
  }

  const workspaceId = input.workspaceId;

  return typeof workspaceId === "string" ? workspaceId : "unknown";
};

const assertMatchingWorkspaceDeleteConfirmation = (confirmationName: string, workspaceName: string) => {
  if (!hasMatchingWorkspaceDeleteConfirmation(confirmationName, workspaceName)) {
    throw new InvalidInputError(WORKSPACE_DELETE_CONFIRMATION_ERROR);
  }
};

interface DeleteWorkspaceWithConfirmationParams {
  input: unknown;
  userId: string;
  auditLoggingCtx: {
    organizationId?: string;
    workspaceId?: string;
    oldObject?: unknown;
  };
}

export const deleteWorkspaceWithConfirmation = async ({
  input,
  userId,
  auditLoggingCtx,
}: DeleteWorkspaceWithConfirmationParams) => {
  const { confirmationName, workspaceId } = parseWorkspaceDeleteActionInput(input);
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError("workspace", workspaceId);
  }

  assertMatchingWorkspaceDeleteConfirmation(confirmationName, workspace.name);

  const organizationId = workspace.organizationId;

  await assertCan({ type: "user", id: userId }, "organization.manage", {
    type: "organization",
    id: organizationId,
  });

  auditLoggingCtx.organizationId = organizationId;
  auditLoggingCtx.workspaceId = workspaceId;
  auditLoggingCtx.oldObject = workspace;

  return await deleteWorkspaceIfNotLast(workspaceId, organizationId);
};
