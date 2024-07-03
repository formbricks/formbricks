"use server";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization, getOrganizationIdFromResponseId } from "@formbricks/lib/actionClient/utils";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { canUserAccessResponse } from "@formbricks/lib/response/auth";
import { deleteResponse, getResponse } from "@formbricks/lib/response/service";
import { canUserModifyResponseNote, canUserResolveResponseNote } from "@formbricks/lib/responseNote/auth";
import {
  createResponseNote,
  resolveResponseNote,
  updateResponseNote,
} from "@formbricks/lib/responseNote/service";
import { createTag, getTag } from "@formbricks/lib/tag/service";
import { canUserAccessTagOnResponse, verifyUserRoleAccess } from "@formbricks/lib/tagOnResponse/auth";
import { addTagToRespone, deleteTagOnResponse } from "@formbricks/lib/tagOnResponse/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponse } from "@formbricks/types/responses";

export const createTagAction = async (environmentId: string, tagName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user!.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(environmentId, session.user!.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await createTag(environmentId, tagName);
};

export const createTagToResponeAction = async (responseId: string, tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTagOnResponse(session.user!.id, tagId, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const tag = await getTag(tagId);
  const { hasDeleteAccess } = await verifyUserRoleAccess(tag!.environmentId, session.user!.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  return await addTagToRespone(responseId, tagId);
};

export const deleteTagOnResponseAction = async (responseId: string, tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTagOnResponse(session.user!.id, tagId, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const tag = await getTag(tagId);
  const { hasDeleteAccess } = await verifyUserRoleAccess(tag!.environmentId, session.user!.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  return await deleteTagOnResponse(responseId, tagId);
};

const ZDeleteResponseAction = z.object({
  responseId: z.string(),
});

export const deleteResponseAction = async (props: z.infer<typeof ZDeleteResponseAction>) =>
  authenticatedActionClient
    .schema(ZDeleteResponseAction)
    .metadata({ rules: ["response", "delete"] })
    // get organizationId from responseId
    .use(async ({ ctx, next }) => {
      const organizationId = await getOrganizationIdFromResponseId(props.responseId);
      return next({ ctx: { ...ctx, organizationId } });
    })
    .use(async ({ ctx, next, metadata }) => {
      await checkAuthorization({
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        rules: metadata.rules,
      });
      return next({ ctx });
    })
    .action(async ({ parsedInput }) => await deleteResponse(parsedInput.responseId))(props);

export const updateResponseNoteAction = async (responseNoteId: string, text: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserModifyResponseNote(session.user!.id, responseNoteId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await updateResponseNote(responseNoteId, text);
};

export const resolveResponseNoteAction = async (responseId: string, responseNoteId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserResolveResponseNote(session.user!.id, responseId, responseNoteId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await resolveResponseNote(responseNoteId);
};

export const createResponseNoteAction = async (responseId: string, userId: string, text: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  const authotized = await canUserAccessResponse(session.user!.id, responseId);
  if (!authotized) throw new AuthorizationError("Not authorized");
  return await createResponseNote(responseId, userId, text);
};

export const getResponseAction = async (responseId: string): Promise<TResponse | null> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  const authotized = await canUserAccessResponse(session.user!.id, responseId);
  if (!authotized) throw new AuthorizationError("Not authorized");
  return await getResponse(responseId);
};
