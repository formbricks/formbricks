"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZLanguageInput } from "@formbricks/types/project";
import {
  createLanguage,
  deleteLanguage,
  getLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@/lib/language/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProjectId,
  getProjectIdFromLanguageId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateLanguageAction = z.object({
  projectId: ZId,
  languageInput: ZLanguageInput,
});

export const createLanguageAction = authenticatedActionClient.inputSchema(ZCreateLanguageAction).action(
  withAuditLogging("created", "language", async ({ ctx, parsedInput }) => {
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

    const result = await createLanguage(parsedInput.projectId, parsedInput.languageInput);
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.languageId = result.id;
    ctx.auditLoggingCtx.newObject = result;

    capturePostHogEvent(
      ctx.user.id,
      "workspace_language_created",
      {
        organization_id: organizationId,
        workspace_id: parsedInput.projectId,
        language_code: result.code,
      },
      { organizationId, workspaceId: parsedInput.projectId }
    );

    return result;
  })
);

const ZDeleteLanguageAction = z.object({
  languageId: ZId,
  projectId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient.inputSchema(ZDeleteLanguageAction).action(
  withAuditLogging("deleted", "language", async ({ ctx, parsedInput }) => {
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

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.languageId = parsedInput.languageId;
    const result = await deleteLanguage(parsedInput.languageId, parsedInput.projectId);
    ctx.auditLoggingCtx.oldObject = result;
    return result;
  })
);

const ZGetSurveysUsingGivenLanguageAction = z.object({
  languageId: ZId,
});

export const getSurveysUsingGivenLanguageAction = authenticatedActionClient
  .inputSchema(ZGetSurveysUsingGivenLanguageAction)
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

    return await getSurveysUsingGivenLanguage(parsedInput.languageId);
  });

const ZUpdateLanguageAction = z.object({
  projectId: ZId,
  languageId: ZId,
  languageInput: ZLanguageInput,
});

export const updateLanguageAction = authenticatedActionClient.inputSchema(ZUpdateLanguageAction).action(
  withAuditLogging("updated", "language", async ({ ctx, parsedInput }) => {
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
  })
);
