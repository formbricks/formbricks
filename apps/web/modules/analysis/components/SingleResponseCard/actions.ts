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
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZCreateTagAction = z.object({
  environmentId: ZId,
  tagName: z.string(),
});

export const createTagAction = authenticatedActionClient
  .schema(ZCreateTagAction)
  .action(async ({ parsedInput, ctx }) => {
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

    return await createTag(parsedInput.environmentId, parsedInput.tagName);
  });

const ZCreateTagToResponseAction = z.object({
  responseId: ZId,
  tagId: ZId,
});

export const createTagToResponseAction = authenticatedActionClient
  .schema(ZCreateTagToResponseAction)
  .action(async ({ parsedInput, ctx }) => {
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

    return await addTagToRespone(parsedInput.responseId, parsedInput.tagId);
  });

const ZDeleteTagOnResponseAction = z.object({
  responseId: ZId,
  tagId: ZId,
});

export const deleteTagOnResponseAction = authenticatedActionClient
  .schema(ZDeleteTagOnResponseAction)
  .action(async ({ parsedInput, ctx }) => {
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

    return await deleteTagOnResponse(parsedInput.responseId, parsedInput.tagId);
  });

const ZDeleteResponseAction = z.object({
  responseId: ZId,
});

export const deleteResponseAction = authenticatedActionClient
  .schema(ZDeleteResponseAction)
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
          projectId: await getProjectIdFromResponseId(parsedInput.responseId),
          minPermission: "readWrite",
        },
      ],
    });

    return await deleteResponse(parsedInput.responseId);
  });

const ZUpdateResponseNoteAction = z.object({
  responseNoteId: ZId,
  text: z.string(),
});

export const updateResponseNoteAction = authenticatedActionClient
  .schema(ZUpdateResponseNoteAction)
  .action(async ({ parsedInput, ctx }) => {
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

    return await updateResponseNote(parsedInput.responseNoteId, parsedInput.text);
  });

const ZResolveResponseNoteAction = z.object({
  responseNoteId: ZId,
});

export const resolveResponseNoteAction = authenticatedActionClient
  .schema(ZResolveResponseNoteAction)
  .action(async ({ parsedInput, ctx }) => {
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

    await resolveResponseNote(parsedInput.responseNoteId);
  });

const ZCreateResponseNoteAction = z.object({
  responseId: ZId,
  text: z.string(),
});

export const createResponseNoteAction = authenticatedActionClient
  .schema(ZCreateResponseNoteAction)
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
          projectId: await getProjectIdFromResponseId(parsedInput.responseId),
          minPermission: "readWrite",
        },
      ],
    });

    return await createResponseNote(parsedInput.responseId, ctx.user.id, parsedInput.text);
  });

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
