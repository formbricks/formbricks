"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromTagId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromTagId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromTagId,
} from "@/lib/utils/helper";
import { deleteTag, mergeTags, updateTagName } from "@/modules/projects/settings/lib/tag";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

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
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromTagId(parsedInput.tagId),
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
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromTagId(parsedInput.tagId),
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
    const originalTagEnvironmentId = await getEnvironmentIdFromTagId(parsedInput.originalTagId);
    const newTagEnvironmentId = await getEnvironmentIdFromTagId(parsedInput.newTagId);

    if (originalTagEnvironmentId !== newTagEnvironmentId) {
      throw new Error("Tags must be in the same environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(newTagEnvironmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromEnvironmentId(newTagEnvironmentId),
        },
      ],
    });

    return await mergeTags(parsedInput.originalTagId, parsedInput.newTagId);
  });
