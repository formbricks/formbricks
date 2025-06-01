"use server";

import { deleteResponse, getResponse } from "@/lib/response/service";
import { createResponseNote, resolveResponseNote, updateResponseNote } from "@/lib/responseNote/service";
import { createTag } from "@/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@/lib/tagOnResponse/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromResponseId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromResponseId,
  getOrganizationIdFromResponseNoteId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromResponseId,
  getProjectIdFromResponseNoteId,
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
  withAuditLogging("created", "tag", async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
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
    ctx.auditLoggingCtx.environmentId = parsedInput.environmentId;
    const result = await createTag(parsedInput.environmentId, parsedInput.tagName);
    ctx.auditLoggingCtx.tagId = result.id;
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZCreateTagToResponseAction = z.object({
  responseId: ZId,
  tagId: ZId,
});

export const createTagToResponseAction = authenticatedActionClient.schema(ZCreateTagToResponseAction).action(
  withAuditLogging("created", "tag", async ({ parsedInput, ctx }) => {
    const responseEnvironmentId = await getEnvironmentIdFromResponseId(parsedInput.responseId);
    const tagEnvironment = await getTag(parsedInput.tagId);

    if (!responseEnvironmentId || !tagEnvironment) {
      throw new Error("Environment not found");
    }

    if (responseEnvironmentId !== tagEnvironment.environmentId) {
      throw new Error("Response and tag are not in the same environment");
    }

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
          projectId: await getProjectIdFromEnvironmentId(responseEnvironmentId),
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.responseId = parsedInput.responseId;
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

export const deleteTagOnResponseAction = authenticatedActionClient.schema(ZDeleteTagOnResponseAction).action(
  withAuditLogging("deleted", "tag", async ({ parsedInput, ctx }) => {
    const responseEnvironmentId = await getEnvironmentIdFromResponseId(parsedInput.responseId);
    const tagEnvironment = await getTag(parsedInput.tagId);

    if (!responseEnvironmentId || !tagEnvironment) {
      throw new Error("Environment not found");
    }

    if (responseEnvironmentId !== tagEnvironment.environmentId) {
      throw new Error("Response and tag are not in the same environment");
    }

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
          projectId: await getProjectIdFromEnvironmentId(responseEnvironmentId),
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.responseId = parsedInput.responseId;
    ctx.auditLoggingCtx.tagId = parsedInput.tagId;
    const result = await deleteTagOnResponse(parsedInput.responseId, parsedInput.tagId);
    ctx.auditLoggingCtx.oldObject = result;
    return result;
  })
);

const ZDeleteResponseAction = z.object({
  responseId: ZId,
});

export const deleteResponseAction = authenticatedActionClient.schema(ZDeleteResponseAction).action(
  withAuditLogging("deleted", "response", async ({ parsedInput, ctx }) => {
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
          projectId: await getProjectIdFromResponseId(parsedInput.responseId),
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.responseId = parsedInput.responseId;
    const result = await deleteResponse(parsedInput.responseId);
    ctx.auditLoggingCtx.oldObject = result;
    return result;
  })
);

const ZUpdateResponseNoteAction = z.object({
  responseNoteId: ZId,
  text: z.string(),
});

export const updateResponseNoteAction = authenticatedActionClient.schema(ZUpdateResponseNoteAction).action(
  withAuditLogging("updated", "response", async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseNoteId(parsedInput.responseNoteId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromResponseNoteId(parsedInput.responseNoteId),
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.responseNoteId = parsedInput.responseNoteId;
    const result = await updateResponseNote(parsedInput.responseNoteId, parsedInput.text);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZResolveResponseNoteAction = z.object({
  responseNoteId: ZId,
});

export const resolveResponseNoteAction = authenticatedActionClient.schema(ZResolveResponseNoteAction).action(
  withAuditLogging("updated", "response", async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseNoteId(parsedInput.responseNoteId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromResponseNoteId(parsedInput.responseNoteId),
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.responseNoteId = parsedInput.responseNoteId;
    const result = await resolveResponseNote(parsedInput.responseNoteId);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZCreateResponseNoteAction = z.object({
  responseId: ZId,
  text: z.string(),
});

export const createResponseNoteAction = authenticatedActionClient.schema(ZCreateResponseNoteAction).action(
  withAuditLogging("created", "response", async ({ parsedInput, ctx }) => {
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
          projectId: await getProjectIdFromResponseId(parsedInput.responseId),
          minPermission: "readWrite",
        },
      ],
    });
    ctx.auditLoggingCtx.responseId = parsedInput.responseId;
    const result = await createResponseNote(parsedInput.responseId, ctx.user.id, parsedInput.text);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
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
