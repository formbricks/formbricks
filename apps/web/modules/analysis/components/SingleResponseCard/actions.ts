"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteResponse, getResponse } from "@/lib/response/service";
import { createTag } from "@/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@/lib/tagOnResponse/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromResponseId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromResponseId,
} from "@/lib/utils/helper";
import { getTag } from "@/lib/utils/services";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateTagAction = z.object({
  workspaceId: ZId,
  tagName: z.string(),
});

export const createTagAction = authenticatedActionClient.inputSchema(ZCreateTagAction).action(
  withAuditLogging("created", "tag", async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.organizationId = organizationId;
    const result = await createTag(parsedInput.workspaceId, parsedInput.tagName);

    if (result.ok) {
      ctx.auditLoggingCtx.tagId = result.data.id;
      ctx.auditLoggingCtx.newObject = result.data;
    } else {
      ctx.auditLoggingCtx.newObject = null;
    }

    return result;
  })
);

const ZCreateTagToResponseAction = z.object({
  responseId: ZId,
  tagId: ZId,
});

export const createTagToResponseAction = authenticatedActionClient
  .inputSchema(ZCreateTagToResponseAction)
  .action(
    withAuditLogging("addedToResponse", "tag", async ({ parsedInput, ctx }) => {
      const responseWorkspaceId = await getWorkspaceIdFromResponseId(parsedInput.responseId);
      const tag = await getTag(parsedInput.tagId);

      if (!responseWorkspaceId || !tag) {
        throw new ResourceNotFoundError("Workspace", null);
      }

      if (responseWorkspaceId !== tag.workspaceId) {
        throw new Error("Response and tag are not in the same workspace");
      }

      const organizationId = await getOrganizationIdFromWorkspaceId(responseWorkspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            workspaceId: responseWorkspaceId,
            minPermission: "readWrite",
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;
      const result = await addTagToRespone(parsedInput.responseId, parsedInput.tagId);
      ctx.auditLoggingCtx.newObject = result;
      return result;
    })
  );

const ZDeleteTagOnResponseAction = z.object({
  responseId: ZId,
  tagId: ZId,
});

export const deleteTagOnResponseAction = authenticatedActionClient
  .inputSchema(ZDeleteTagOnResponseAction)
  .action(
    withAuditLogging("removedFromResponse", "tag", async ({ parsedInput, ctx }) => {
      const responseWorkspaceId = await getWorkspaceIdFromResponseId(parsedInput.responseId);
      const tag = await getTag(parsedInput.tagId);
      const organizationId = await getOrganizationIdFromResponseId(parsedInput.responseId);
      if (!responseWorkspaceId || !tag) {
        throw new ResourceNotFoundError("Workspace", null);
      }

      if (responseWorkspaceId !== tag.workspaceId) {
        throw new Error("Response and tag are not in the same workspace");
      }

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            workspaceId: responseWorkspaceId,
            minPermission: "readWrite",
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;
      const result = await deleteTagOnResponse(parsedInput.responseId, parsedInput.tagId);
      ctx.auditLoggingCtx.oldObject = result;
      return result;
    })
  );

const ZDeleteResponseAction = z.object({
  responseId: ZId,
  decrementQuotas: z.boolean().prefault(false),
});

export const deleteResponseAction = authenticatedActionClient.inputSchema(ZDeleteResponseAction).action(
  withAuditLogging("deleted", "response", async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromResponseId(parsedInput.responseId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: await getWorkspaceIdFromResponseId(parsedInput.responseId),
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.responseId = parsedInput.responseId;
    const result = await deleteResponse(parsedInput.responseId, parsedInput.decrementQuotas);
    ctx.auditLoggingCtx.oldObject = result;
    return result;
  })
);

const ZGetResponseAction = z.object({
  responseId: ZId,
});

export const getResponseAction = authenticatedActionClient
  .inputSchema(ZGetResponseAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseId(parsedInput.responseId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromResponseId(parsedInput.responseId),
        },
      ],
    });

    return await getResponse(parsedInput.responseId);
  });
