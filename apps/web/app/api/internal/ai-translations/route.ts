/**
 * POST /api/internal/ai-translations?workspaceId= — translate a survey's texts for the editor's Manage
 * translations dialog. Nothing is saved: the editor merges the result into its draft, so nothing is
 * audited. Session-only; the survey editor is the only caller.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { translateSurveyFieldsOperation } from "./lib/operations";
import { ZAITranslationBody, ZAITranslationWorkspaceQuery } from "./schemas";

// @formbricks/ai pulls the provider SDKs, none of which are edge-compatible.
export const runtime = "nodejs";

export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZAITranslationWorkspaceQuery, body: ZAITranslationBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    translateSurveyFieldsOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});
