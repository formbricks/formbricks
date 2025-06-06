"use server";

import {
  createLanguage,
  deleteLanguage,
  getLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@/lib/language/service";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProjectId,
  getProjectIdFromLanguageId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZLanguageInput } from "@formbricks/types/project";

const ZCreateLanguageAction = z.object({
  projectId: ZId,
  languageInput: ZLanguageInput,
});

export const checkMultiLanguagePermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization.billing.plan);

  if (!isMultiLanguageAllowed) {
    throw new OperationNotAllowedError("Multi language is not allowed for this organization");
  }
};

export const createLanguageAction = authenticatedActionClient.schema(ZCreateLanguageAction).action(
  withAuditLogging(
    "created",
    "language",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            schema: ZLanguageInput,
            data: parsedInput.languageInput,
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: parsedInput.projectId,
            minPermission: "manage",
          },
        ],
      });
      await checkMultiLanguagePermission(organizationId);

      const result = await createLanguage(parsedInput.projectId, parsedInput.languageInput);
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.languageId = result.id;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);

const ZDeleteLanguageAction = z.object({
  languageId: ZId,
  projectId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient.schema(ZDeleteLanguageAction).action(
  withAuditLogging(
    "deleted",
    "language",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const languageProjectId = await getProjectIdFromLanguageId(parsedInput.languageId);

      if (languageProjectId !== parsedInput.projectId) {
        throw new Error("Invalid language id");
      }

      const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

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
            projectId: parsedInput.projectId,
            minPermission: "manage",
          },
        ],
      });
      await checkMultiLanguagePermission(organizationId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.languageId = parsedInput.languageId;
      const result = await deleteLanguage(parsedInput.languageId, parsedInput.projectId);
      ctx.auditLoggingCtx.oldObject = result;
      return result;
    }
  )
);

const ZGetSurveysUsingGivenLanguageAction = z.object({
  languageId: ZId,
});

export const getSurveysUsingGivenLanguageAction = authenticatedActionClient
  .schema(ZGetSurveysUsingGivenLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromLanguageId(parsedInput.languageId);

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
          projectId: await getProjectIdFromLanguageId(parsedInput.languageId),
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

    return await getSurveysUsingGivenLanguage(parsedInput.languageId);
  });

const ZUpdateLanguageAction = z.object({
  projectId: ZId,
  languageId: ZId,
  languageInput: ZLanguageInput,
});

export const updateLanguageAction = authenticatedActionClient.schema(ZUpdateLanguageAction).action(
  withAuditLogging(
    "updated",
    "language",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const languageProductId = await getProjectIdFromLanguageId(parsedInput.languageId);

      if (languageProductId !== parsedInput.projectId) {
        throw new Error("Invalid language id");
      }

      const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            schema: ZLanguageInput,
            data: parsedInput.languageInput,
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: parsedInput.projectId,
            minPermission: "manage",
          },
        ],
      });
      await checkMultiLanguagePermission(organizationId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.languageId = parsedInput.languageId;
      ctx.auditLoggingCtx.oldObject = await getLanguage(parsedInput.languageId);
      const result = await updateLanguage(
        parsedInput.projectId,
        parsedInput.languageId,
        parsedInput.languageInput
      );
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);
