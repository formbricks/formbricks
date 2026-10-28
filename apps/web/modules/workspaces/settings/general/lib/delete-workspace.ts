import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TWorkspace } from "@formbricks/types/workspace";
import { assertCan } from "@/lib/authorization";
import { FORMBRICKS_WORKSPACE_ID_COOKIE } from "@/lib/localStorage";
import { getWorkspace, getWorkspaces } from "@/lib/workspace/service";
import { deleteWorkspaceIfNotLast } from "@/modules/workspaces/settings/lib/workspace";
import {
  WORKSPACE_DELETE_CONFIRMATION_ERROR,
  hasMatchingWorkspaceDeleteConfirmation,
} from "./delete-workspace-confirmation";
import {
  TPostWorkspaceDeletionDestination,
  getPostDeletionDestination,
} from "./post-workspace-deletion-redirect";

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

/**
 * Where the dashboard goes once `deletedWorkspace` is gone, with the workspace cookie pointed at it. Call it
 * only after the deletion has committed. Never throws: the workspace is already gone, so failing to pick
 * where to go next must not report the deletion as failed.
 */
export const resolvePostWorkspaceDeletionDestination = async (
  deletedWorkspace: Pick<TWorkspace, "id" | "organizationId">
): Promise<TPostWorkspaceDeletionDestination> => {
  const { id: workspaceId, organizationId } = deletedWorkspace;

  // Resolved here rather than when the settings page rendered, so the surviving workspaces and the
  // onboarding gate are both read at navigation time. `getWorkspaces` has not been called in this
  // request yet, so its React cache entry is cold and this is a fresh read. Only owners and managers
  // reach this point, and they can open every workspace of the organization.
  let destination = FALLBACK_DESTINATION;
  try {
    const remainingWorkspaces = await getWorkspaces(organizationId);
    destination = await getPostDeletionDestination({
      organizationId,
      currentWorkspace: deletedWorkspace,
      availableWorkspaces: remainingWorkspaces,
    });
  } catch (error) {
    // "/" re-resolves a landing workspace on its own.
    logger.error({ error, workspaceId, organizationId }, "Post-deletion destination resolution failed");
  }

  try {
    // Kept in its own boundary so the cookie always matches the destination we return — on the
    // fallback that means clearing it, rather than leaving it naming the workspace just deleted.
    await rememberActiveWorkspace(destination.workspaceId);
  } catch (error) {
    logger.error({ error, workspaceId, organizationId }, "Post-deletion active workspace update failed");
  }

  return destination;
};

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

  if (!hasMatchingWorkspaceDeleteConfirmation(confirmationName, workspace.name)) {
    throw new InvalidInputError(WORKSPACE_DELETE_CONFIRMATION_ERROR);
  }

  const organizationId = workspace.organizationId;

  await assertCan({ type: "user", id: userId }, "organization.manage", {
    type: "organization",
    id: organizationId,
  });

  auditLoggingCtx.organizationId = organizationId;
  auditLoggingCtx.workspaceId = workspaceId;
  auditLoggingCtx.oldObject = workspace;

  const deletedWorkspace = await deleteWorkspaceIfNotLast(workspaceId, organizationId);
  const destination = await resolvePostWorkspaceDeletionDestination(workspace);

  return { workspace: deletedWorkspace, destination };
};
