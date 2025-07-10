"use server";

import { getTag } from "@/lib/tag/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getEnvironmentIdFromTagId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromTagId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromTagId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { deleteTag, mergeTags, updateTagName } from "@/modules/projects/settings/lib/tag";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZDeleteTagAction = z.object({
  tagId: ZId,
});

export const deleteTagAction = authenticatedActionClient.schema(ZDeleteTagAction).action(
  withAuditLogging(
    "deleted",
    "tag",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromTagId(parsedInput.tagId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
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

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;

      const result = await deleteTag(parsedInput.tagId);
      if (result.ok) {
        ctx.auditLoggingCtx.oldObject = result.data;
      } else {
        ctx.auditLoggingCtx.oldObject = null;
      }
      return result;
    }
  )
);

const ZUpdateTagNameAction = z.object({
  tagId: ZId,
  name: z.string(),
});

export const updateTagNameAction = authenticatedActionClient.schema(ZUpdateTagNameAction).action(
  withAuditLogging(
    "updated",
    "tag",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromTagId(parsedInput.tagId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
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

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = parsedInput.tagId;
      ctx.auditLoggingCtx.oldObject = await getTag(parsedInput.tagId);

      const result = await updateTagName(parsedInput.tagId, parsedInput.name);

      if (result.ok) {
        ctx.auditLoggingCtx.newObject = result.data;
      } else {
        ctx.auditLoggingCtx.newObject = null;
      }
      return result;
    }
  )
);

const ZMergeTagsAction = z.object({
  originalTagId: ZId,
  newTagId: ZId,
});

export const mergeTagsAction = authenticatedActionClient.schema(ZMergeTagsAction).action(
  withAuditLogging(
    "merged",
    "tag",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const originalTagEnvironmentId = await getEnvironmentIdFromTagId(parsedInput.originalTagId);
      const newTagEnvironmentId = await getEnvironmentIdFromTagId(parsedInput.newTagId);

      if (originalTagEnvironmentId !== newTagEnvironmentId) {
        throw new Error("Tags must be in the same environment");
      }

      const organizationId = await getOrganizationIdFromEnvironmentId(newTagEnvironmentId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
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

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.tagId = `${parsedInput.originalTagId}-${parsedInput.newTagId}`;

      const result = await mergeTags(parsedInput.originalTagId, parsedInput.newTagId);

      if (result.ok) {
        ctx.auditLoggingCtx.newObject = result.data;
      } else {
        ctx.auditLoggingCtx.newObject = null;
      }
      return result;
    }
  )
);
