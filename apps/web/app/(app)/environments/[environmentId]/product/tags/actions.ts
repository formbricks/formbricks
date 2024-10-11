"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromTagId } from "@formbricks/lib/organization/utils";
import { deleteTag, mergeTags, updateTagName } from "@formbricks/lib/tag/service";
import { ZId } from "@formbricks/types/common";

const ZDeleteTagAction = z.object({
  tagId: ZId,
});

export const deleteTagAction = authenticatedActionClient
  .schema(ZDeleteTagAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.tagId),
      rules: ["tag", "delete"],
    });

    return await deleteTag(parsedInput.tagId);
  });

const ZUpdateTagNameAction = z.object({
  tagId: ZId,
  name: z.string(),
});

export const updateTagNameAction = authenticatedActionClient
  .schema(ZUpdateTagNameAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.tagId),
      rules: ["tag", "update"],
    });

    return await updateTagName(parsedInput.tagId, parsedInput.name);
  });

const ZMergeTagsAction = z.object({
  originalTagId: ZId,
  newTagId: ZId,
});

export const mergeTagsAction = authenticatedActionClient
  .schema(ZMergeTagsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.originalTagId),
      rules: ["tag", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.newTagId),
      rules: ["tag", "update"],
    });

    return await mergeTags(parsedInput.originalTagId, parsedInput.newTagId);
  });
