"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { isExpectedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { deleteWorkspaceWithConfirmation, getWorkspaceIdForLogging } from "./lib/delete-workspace";

const logWorkspaceDeletionError = (userId: string, workspaceId: string, error: unknown) => {
  logger.error({ error, userId, workspaceId }, "Workspace deletion failed");
};

const shouldLogWorkspaceDeletionError = (error: unknown) => {
  return !(error instanceof Error && isExpectedError(error));
};

export const deleteWorkspaceAction = authenticatedActionClient.inputSchema(z.unknown()).action(
  withAuditLogging("deleted", "workspace", async ({ ctx, parsedInput }) => {
    const workspaceIdForLogging = getWorkspaceIdForLogging(parsedInput);

    try {
      return await deleteWorkspaceWithConfirmation({
        input: parsedInput,
        userId: ctx.user.id,
        auditLoggingCtx: ctx.auditLoggingCtx,
      });
    } catch (error) {
      if (shouldLogWorkspaceDeletionError(error)) {
        logWorkspaceDeletionError(ctx.user.id, workspaceIdForLogging, error);
      }
      throw error;
    }
  })
);
