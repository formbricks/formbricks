"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromResponseId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromResponseId,
  getOrganizationIdFromResponseNoteId,
  getProductIdFromEnvironmentId,
  getProductIdFromResponseId,
  getProductIdFromResponseNoteId,
} from "@/lib/utils/helper";
import { getTag } from "@/lib/utils/services";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { deleteResponse, getResponse } from "@formbricks/lib/response/service";
import {
  createResponseNote,
  resolveResponseNote,
  updateResponseNote,
} from "@formbricks/lib/responseNote/service";
import { createTag } from "@formbricks/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@formbricks/lib/tagOnResponse/service";
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
          rules: ["tag", "create"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
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
          rules: ["response", "update"],
        },
        {
          type: "organization",
          rules: ["tag", "read"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromEnvironmentId(responseEnvironmentId),
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
          rules: ["response", "update"],
        },
        {
          type: "organization",
          rules: ["tag", "delete"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromEnvironmentId(responseEnvironmentId),
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
          rules: ["response", "delete"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromResponseId(parsedInput.responseId),
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
          rules: ["responseNote", "update"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromResponseNoteId(parsedInput.responseNoteId),
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
          rules: ["responseNote", "update"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromResponseNoteId(parsedInput.responseNoteId),
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
          rules: ["responseNote", "create"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromResponseId(parsedInput.responseId),
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
          rules: ["response", "read"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromResponseId(parsedInput.responseId),
        },
      ],
    });

    return await getResponse(parsedInput.responseId);
  });
