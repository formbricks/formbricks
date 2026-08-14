import { cookies } from "next/headers";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { FORMBRICKS_WORKSPACE_ID_COOKIE } from "@/lib/localStorage";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getUserWorkspaces, getWorkspace } from "@/lib/workspace/service";
import { deleteWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import {
  WORKSPACE_DELETE_CONFIRMATION_ERROR,
  hasMatchingWorkspaceDeleteConfirmation,
} from "./delete-workspace-confirmation";
import {
  TPostWorkspaceDeletionDestination,
  getPostDeletionDestination,
} from "./post-workspace-deletion-redirect";

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

const FALLBACK_DESTINATION: TPostWorkspaceDeletionDestination = { workspaceId: null, path: "/" };

/**
 * Points the server-readable "last active workspace" at the workspace we are about to open.
 *
 * The proxy only refreshes this cookie on `/workspaces/:id` paths, so when the destination is the
 * onboarding flow (or "/") nothing would clear it and it would keep naming the workspace we just
 * deleted — which makes the account-settings organization resolution fall back to the user's first
 * organization, the exact multi-organization mis-routing this flow exists to prevent.
 */
const rememberActiveWorkspace = async (workspaceId: string | null) => {
  const cookieStore = await cookies();

  if (workspaceId) {
    cookieStore.set(FORMBRICKS_WORKSPACE_ID_COOKIE, workspaceId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    cookieStore.delete(FORMBRICKS_WORKSPACE_ID_COOKIE);
  }
};

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

  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
    ],
  });

  const availableWorkspaces = await getUserWorkspaces(userId, organizationId);

  if (availableWorkspaces.length <= 1) {
    throw new OperationNotAllowedError("You can't delete the last workspace.");
  }

  auditLoggingCtx.organizationId = organizationId;
  auditLoggingCtx.workspaceId = workspaceId;
  auditLoggingCtx.oldObject = workspace;

  const deletedWorkspace = await deleteWorkspace(workspaceId);

  // Resolved here rather than when the settings page rendered, so the surviving-workspace list and
  // the onboarding gate are both read at navigation time. `availableWorkspaces` still contains the
  // workspace we just deleted; getPostDeletionDestination filters it out.
  let destination = FALLBACK_DESTINATION;
  try {
    destination = await getPostDeletionDestination({
      organizationId,
      currentWorkspace: workspace,
      availableWorkspaces,
    });
    await rememberActiveWorkspace(destination.workspaceId);
  } catch (error) {
    // The workspace is already gone; failing to pick where to go next must not report the deletion
    // as failed. "/" re-resolves a landing workspace on its own.
    logger.error({ error, workspaceId, organizationId }, "Post-deletion destination resolution failed");
  }

  return { workspace: deletedWorkspace, destination };
};
