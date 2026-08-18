"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { deleteResponse, getResponse, getResponseWithQuotas } from "@/lib/response/service";
import { createTag, getTagsByWorkspaceId } from "@/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@/lib/tagOnResponse/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import {
  getOrganizationIdFromResponseId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromResponseId,
  getWorkspaceIdFromSurveyId,
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

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: parsedInput.workspaceId,
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
      const response = await getResponse(parsedInput.responseId);
      const tag = await getTag(parsedInput.tagId);

      if (!response || !tag) {
        throw new ResourceNotFoundError("Workspace", null);
      }

      const responseWorkspaceId = await getWorkspaceIdFromSurveyId(response.surveyId);

      if (responseWorkspaceId !== tag.workspaceId) {
        throw new Error("Response and tag are not in the same workspace");
      }

      const organizationId = await getOrganizationIdFromWorkspaceId(responseWorkspaceId);

      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: responseWorkspaceId,
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;
      const result = await addTagToRespone(parsedInput.responseId, parsedInput.tagId);
      ctx.auditLoggingCtx.newObject = result;
      revalidatePath(`/workspaces/${responseWorkspaceId}/surveys/${response.surveyId}`);
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
      const response = await getResponse(parsedInput.responseId);
      const tag = await getTag(parsedInput.tagId);
      const organizationId = await getOrganizationIdFromResponseId(parsedInput.responseId);
      if (!response || !tag) {
        throw new ResourceNotFoundError("Workspace", null);
      }

      const responseWorkspaceId = await getWorkspaceIdFromSurveyId(response.surveyId);

      if (responseWorkspaceId !== tag.workspaceId) {
        throw new Error("Response and tag are not in the same workspace");
      }

      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: responseWorkspaceId,
      });
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;
      const result = await deleteTagOnResponse(parsedInput.responseId, parsedInput.tagId);
      ctx.auditLoggingCtx.oldObject = result;
      revalidatePath(`/workspaces/${responseWorkspaceId}/surveys/${response.surveyId}`);
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
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: await getWorkspaceIdFromResponseId(parsedInput.responseId),
    });
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.responseId = parsedInput.responseId;
    const result = await deleteResponse(parsedInput.responseId, parsedInput.decrementQuotas);
    ctx.auditLoggingCtx.oldObject = result;
    revalidatePath(
      `/workspaces/${await getWorkspaceIdFromSurveyId(result.surveyId)}/surveys/${result.surveyId}`
    );
    return result;
  })
);

const ZGetTagsByWorkspaceIdAction = z.object({
  workspaceId: ZId,
});

export const getTagsByWorkspaceIdAction = authenticatedActionClient
  .inputSchema(ZGetTagsByWorkspaceIdAction)
  .action(async ({ parsedInput, ctx }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.read", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });

    return await getTagsByWorkspaceId(parsedInput.workspaceId);
  });

const ZGetResponseAction = z.object({
  responseId: ZId,
});

export const getResponseAction = authenticatedActionClient
  .inputSchema(ZGetResponseAction)
  .action(async ({ parsedInput, ctx }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.read", {
      type: "workspace",
      id: await getWorkspaceIdFromResponseId(parsedInput.responseId),
    });

    return await getResponseWithQuotas(parsedInput.responseId);
  });
