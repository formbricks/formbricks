"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZLanguageInput, ZLanguageUpdate } from "@formbricks/types/workspace";
import {
  createLanguage,
  deleteLanguage,
  getLanguage,
  getSurveysUsingGivenLanguage,
  setWorkspaceDefaultLanguage,
  updateLanguage,
} from "@/lib/language/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromLanguageId,
} from "@/lib/utils/helper";
import { getWorkspace } from "@/lib/workspace/service";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateLanguageAction = z.object({
  workspaceId: ZId,
  languageInput: ZLanguageInput,
});

export const createLanguageAction = authenticatedActionClient.inputSchema(ZCreateLanguageAction).action(
  withAuditLogging("created", "language", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

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
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "manage",
        },
      ],
    });

    const result = await createLanguage(parsedInput.workspaceId, parsedInput.languageInput);
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.languageId = result.id;
    ctx.auditLoggingCtx.newObject = result;

    capturePostHogEvent(
      ctx.user.id,
      "workspace_language_created",
      {
        organization_id: organizationId,
        workspace_id: parsedInput.workspaceId,
        language_code: result.code,
      },
      { organizationId, workspaceId: parsedInput.workspaceId }
    );

    return result;
  })
);

const ZDeleteLanguageAction = z.object({
  languageId: ZId,
  workspaceId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient.inputSchema(ZDeleteLanguageAction).action(
  withAuditLogging("deleted", "language", async ({ ctx, parsedInput }) => {
    const languageWorkspaceId = await getWorkspaceIdFromLanguageId(parsedInput.languageId);

    if (languageWorkspaceId !== parsedInput.workspaceId) {
      throw new Error("Invalid language id");
    }

    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "manage",
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.languageId = parsedInput.languageId;
    const result = await deleteLanguage(parsedInput.languageId, parsedInput.workspaceId);
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
          type: "workspaceTeam",
          workspaceId: await getWorkspaceIdFromLanguageId(parsedInput.languageId),
          minPermission: "manage",
        },
      ],
    });

    return await getSurveysUsingGivenLanguage(parsedInput.languageId);
  });

const ZUpdateLanguageAction = z.object({
  workspaceId: ZId,
  languageId: ZId,
  // Alias-only: a language's `code` is immutable (it stays canonical). Using ZLanguageUpdate strips any
  // `code` a caller sends before it reaches the service.
  languageInput: ZLanguageUpdate,
});

export const updateLanguageAction = authenticatedActionClient.inputSchema(ZUpdateLanguageAction).action(
  withAuditLogging("updated", "language", async ({ ctx, parsedInput }) => {
    const languageProductId = await getWorkspaceIdFromLanguageId(parsedInput.languageId);

    if (languageProductId !== parsedInput.workspaceId) {
      throw new Error("Invalid language id");
    }

    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          schema: ZLanguageUpdate,
          data: parsedInput.languageInput,
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "manage",
        },
      ],
    });

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.languageId = parsedInput.languageId;
    ctx.auditLoggingCtx.oldObject = await getLanguage(parsedInput.languageId);
    const result = await updateLanguage(
      parsedInput.workspaceId,
      parsedInput.languageId,
      parsedInput.languageInput
    );
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZUpdateWorkspaceDefaultLanguageAction = z.object({
  workspaceId: ZId,
  // null clears the default (new surveys fall back to the creator's UI locale).
  languageCode: z.string().nullable(),
});

export const updateWorkspaceDefaultLanguageAction = authenticatedActionClient
  .inputSchema(ZUpdateWorkspaceDefaultLanguageAction)
  .action(
    withAuditLogging("updated", "workspace", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            workspaceId: parsedInput.workspaceId,
            minPermission: "manage",
          },
        ],
      });

      const oldObject = await getWorkspace(parsedInput.workspaceId);
      const defaultLanguageCode = await setWorkspaceDefaultLanguage(
        parsedInput.workspaceId,
        parsedInput.languageCode
      );

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.workspaceId = parsedInput.workspaceId;
      ctx.auditLoggingCtx.oldObject = oldObject;
      // Build the new snapshot from the persisted code — re-reading here would return the request-cached
      // pre-update workspace.
      ctx.auditLoggingCtx.newObject = oldObject ? { ...oldObject, defaultLanguageCode } : null;

      capturePostHogEvent(
        ctx.user.id,
        "workspace_default_language_set",
        {
          organization_id: organizationId,
          workspace_id: parsedInput.workspaceId,
          language_code: parsedInput.languageCode,
        },
        { organizationId, workspaceId: parsedInput.workspaceId }
      );
    })
  );
