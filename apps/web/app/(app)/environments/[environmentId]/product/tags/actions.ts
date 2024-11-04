"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromTagId, getProductIdFromTagId } from "@/lib/utils/helper";
import { getTag } from "@/lib/utils/services";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { deleteTag, mergeTags, updateTagName } from "@formbricks/lib/tag/service";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const ZDeleteTagAction = z.object({
  tagId: ZId,
});

export const deleteTagAction = authenticatedActionClient
  .schema(ZDeleteTagAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.tagId),
      access: [
        {
          type: "organization",
          rules: ["tag", "delete"],
        },
        {
          type: "product",
          minPermission: "readWrite",
          productId: await getProductIdFromTagId(parsedInput.tagId),
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.tagId),
      access: [
        {
          type: "organization",
          rules: ["tag", "update"],
        },
        {
          type: "product",
          minPermission: "readWrite",
          productId: await getProductIdFromTagId(parsedInput.tagId),
        },
      ],
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
    const originalTag = await getTag(parsedInput.originalTagId);
    const newTag = await getTag(parsedInput.newTagId);

    if (!originalTag || !newTag) {
      throw new ResourceNotFoundError("tag", originalTag ? parsedInput.newTagId : parsedInput.originalTagId);
    }

    if (originalTag.environmentId !== newTag.environmentId) {
      throw new Error("Tags must be in the same environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTagId(parsedInput.originalTagId),
      access: [
        {
          type: "organization",
          rules: ["tag", "update"],
        },
        {
          type: "product",
          minPermission: "readWrite",
          productId: await getProductIdFromTagId(parsedInput.originalTagId),
        },
      ],
    });

    return await mergeTags(parsedInput.originalTagId, parsedInput.newTagId);
  });
