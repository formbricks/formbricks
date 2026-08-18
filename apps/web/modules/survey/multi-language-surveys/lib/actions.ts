"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZLanguageInput, ZLanguageUpdate } from "@formbricks/types/workspace";
import { assertCan } from "@/lib/authorization";
import {
  createLanguage,
  deleteLanguage,
  getLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@/lib/language/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromLanguageId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZCreateLanguageAction = z.object({
  workspaceId: ZId,
  languageInput: ZLanguageInput,
});

export const createLanguageAction = authenticatedActionClient.inputSchema(ZCreateLanguageAction).action(
  withAuditLogging("created", "language", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.manage", {
      type: "workspace",
      id: parsedInput.workspaceId,
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

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.manage", {
      type: "workspace",
      id: parsedInput.workspaceId,
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
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.manage", {
      type: "workspace",
      id: await getWorkspaceIdFromLanguageId(parsedInput.languageId),
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

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.manage", {
      type: "workspace",
      id: parsedInput.workspaceId,
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
