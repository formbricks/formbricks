"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromResponseId,
  getOrganizationIdFromResponseNoteId,
  getOrganizationIdFromTagId,
} from "@formbricks/lib/organization/utils";
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["tag", "create"],
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseId(parsedInput.responseId),
      rules: ["response", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.tagId),
      rules: ["tag", "read"],
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseId(parsedInput.responseId),
      rules: ["response", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.tagId),
      rules: ["tag", "read"],
    });

    return await deleteTagOnResponse(parsedInput.responseId, parsedInput.tagId);
  });

const ZDeleteResponseAction = z.object({
  responseId: ZId,
});

export const deleteResponseAction = authenticatedActionClient
  .schema(ZDeleteResponseAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseId(parsedInput.responseId),
      rules: ["response", "delete"],
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseNoteId(parsedInput.responseNoteId),
      rules: ["response", "update"],
    });

    return await updateResponseNote(parsedInput.responseNoteId, parsedInput.text);
  });

const ZResolveResponseNoteAction = z.object({
  responseNoteId: ZId,
});

export const resolveResponseNoteAction = authenticatedActionClient
  .schema(ZResolveResponseNoteAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseNoteId(parsedInput.responseNoteId),
      rules: ["responseNote", "update"],
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseId(parsedInput.responseId),
      rules: ["responseNote", "create"],
    });

    return await createResponseNote(parsedInput.responseId, ctx.user.id, parsedInput.text);
  });

const ZGetResponseAction = z.object({
  responseId: ZId,
});

export const getResponseAction = authenticatedActionClient
  .schema(ZGetResponseAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromResponseId(parsedInput.responseId),
      rules: ["response", "read"],
    });

    return await getResponse(parsedInput.responseId);
  });
