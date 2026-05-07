"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { deleteProjectWithConfirmation, getProjectIdForLogging } from "./lib/delete-project";

const logProjectDeletionError = (userId: string, projectId: string, error: unknown) => {
  logger.error({ error, userId, projectId }, "Workspace deletion failed");
};

export const deleteProjectAction = authenticatedActionClient.inputSchema(z.unknown()).action(
  withAuditLogging("deleted", "project", async ({ ctx, parsedInput }) => {
    const projectIdForLogging = getProjectIdForLogging(parsedInput);

    try {
      return await deleteProjectWithConfirmation({
        input: parsedInput,
        userId: ctx.user.id,
        auditLoggingCtx: ctx.auditLoggingCtx,
      });
    } catch (error) {
      logProjectDeletionError(ctx.user.id, projectIdForLogging, error);
      throw error;
    }
  })
);
