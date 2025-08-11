"use server";

import { deleteResponse, getResponse } from "@/lib/response/service";
import { createTag } from "@/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@/lib/tagOnResponse/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getEnvironmentIdFromResponseId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromResponseId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromResponseId,
} from "@/lib/utils/helper";
import { getTag } from "@/lib/utils/services";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZCreateTagAction = z.object({
  environmentId: ZId,
  tagName: z.string(),
});

export const createTagAction = authenticatedActionClient.schema(ZCreateTagAction).action(
  withAuditLogging(
    "created",
    "tag",
    async ({ parsedInput, ctx }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
            minPermission: "readWrite",
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await createTag(parsedInput.environmentId, parsedInput.tagName);

      if (result.ok) {
        ctx.auditLoggingCtx.tagId = result.data.id;
        ctx.auditLoggingCtx.newObject = result.data;
      } else {
        ctx.auditLoggingCtx.newObject = null;
      }

      return result;
    }
  )
);

const ZCreateTagToResponseAction = z.object({
  responseId: ZId,
  tagId: ZId,
});

export const createTagToResponseAction = authenticatedActionClient.schema(ZCreateTagToResponseAction).action(
  withAuditLogging(
    "addedToResponse",
    "tag",
    async ({ parsedInput, ctx }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const responseEnvironmentId = await getEnvironmentIdFromResponseId(parsedInput.responseId);
      const tagEnvironment = await getTag(parsedInput.tagId);

      if (!responseEnvironmentId || !tagEnvironment) {
        throw new Error("Environment not found");
      }

      if (responseEnvironmentId !== tagEnvironment.environmentId) {
        throw new Error("Response and tag are not in the same environment");
      }

      const organizationId = await getOrganizationIdFromEnvironmentId(responseEnvironmentId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: await getProjectIdFromEnvironmentId(responseEnvironmentId),
            minPermission: "readWrite",
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;
      const result = await addTagToRespone(parsedInput.responseId, parsedInput.tagId);
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);

const ZDeleteTagOnResponseAction = z.object({
  responseId: ZId,
  tagId: ZId,
});

export const deleteTagOnResponseAction = authenticatedActionClient.schema(ZDeleteTagOnResponseAction).action(
  withAuditLogging(
    "removedFromResponse",
    "tag",
    async ({ parsedInput, ctx }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const responseEnvironmentId = await getEnvironmentIdFromResponseId(parsedInput.responseId);
      const tagEnvironment = await getTag(parsedInput.tagId);
      const organizationId = await getOrganizationIdFromResponseId(parsedInput.responseId);
      if (!responseEnvironmentId || !tagEnvironment) {
        throw new Error("Environment not found");
      }

      if (responseEnvironmentId !== tagEnvironment.environmentId) {
        throw new Error("Response and tag are not in the same environment");
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
            type: "projectTeam",
            projectId: await getProjectIdFromEnvironmentId(responseEnvironmentId),
            minPermission: "readWrite",
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;
      const result = await deleteTagOnResponse(parsedInput.responseId, parsedInput.tagId);
      ctx.auditLoggingCtx.oldObject = result;
      return result;
    }
  )
);

const ZDeleteResponseAction = z.object({
  responseId: ZId,
});

export const deleteResponseAction = authenticatedActionClient.schema(ZDeleteResponseAction).action(
  withAuditLogging(
    "deleted",
    "response",
    async ({ parsedInput, ctx }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
            type: "projectTeam",
            projectId: await getProjectIdFromResponseId(parsedInput.responseId),
            minPermission: "readWrite",
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.responseId = parsedInput.responseId;
      const result = await deleteResponse(parsedInput.responseId);
      ctx.auditLoggingCtx.oldObject = result;
      return result;
    }
  )
);

const ZGetResponseAction = z.object({
  responseId: ZId,
});

export const getResponseAction = authenticatedActionClient
  .schema(ZGetResponseAction)
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
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromResponseId(parsedInput.responseId),
        },
      ],
    });

    return await getResponse(parsedInput.responseId);
  });
