"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromResponseId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromResponseId,
  getOrganizationIdFromResponseNoteId,
  getSurveyIdFromResponseId,
  getSurveyIdFromResponseNoteId,
} from "@/lib/utils/helper";
import { getTag } from "@/lib/utils/services";
import { z } from "zod";
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
          roles: ["owner", "manager"],
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
      surveyId: await getSurveyIdFromResponseId(parsedInput.responseId),
      access: [
        {
          type: "survey",
          roles: [],
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
      surveyId: await getSurveyIdFromResponseNoteId(parsedInput.responseNoteId),
      access: [
        {
          type: "survey",
          roles: [],
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
      surveyId: await getSurveyIdFromResponseNoteId(parsedInput.responseNoteId),
      access: [
        {
          type: "survey",
          roles: [],
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
      surveyId: await getSurveyIdFromResponseId(parsedInput.responseId),
      access: [
        {
          type: "survey",
          roles: [],
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
      surveyId: await getSurveyIdFromResponseId(parsedInput.responseId),
      access: [
        {
          type: "survey",
          roles: [],
        },
      ],
    });

    return await getResponse(parsedInput.responseId);
  });
