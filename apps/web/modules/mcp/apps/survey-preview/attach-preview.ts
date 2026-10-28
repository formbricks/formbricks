import type { CallToolResult } from "@modelcontextprotocol/server";
import { loadSurveyPreviewMeta } from "./load-preview-meta";
import { ZShowSurveyData } from "./schemas";

/**
 * Lets a tool that answers with the full survey (`create_survey`, `patch_survey`) open it in the survey
 * view without a second call: the user sees what was just made instead of having to ask for it.
 *
 * The write has already happened and answered for this survey, so authorization and tenancy are decided;
 * this only adds the view's render data to `_meta.formbricks`, where ChatGPT keeps it from the model. A
 * failed write, an answer that is not a whole survey, or a preview that cannot be built returns the
 * result untouched: the person still gets the plain result.
 */
export const attachSurveyPreview = async (
  result: CallToolResult,
  requestId: string
): Promise<CallToolResult> => {
  if (result.isError) return result;

  // Only `data` is read: a write can answer with siblings the strict tool-output envelope does not name
  // (a create with custom CSS adds top-level `warnings`), and that must not cost the preview.
  const structured = result.structuredContent;
  const parsed = ZShowSurveyData.safeParse(
    typeof structured === "object" && structured !== null && "data" in structured
      ? structured.data
      : undefined
  );
  if (!parsed.success) return result;
  const data = parsed.data;

  const preview = await loadSurveyPreviewMeta({
    surveyId: data.id,
    expectedWorkspaceId: data.workspaceId,
    requestId,
  });
  if (!preview) return result;

  return { ...result, _meta: { ...result._meta, formbricks: preview } };
};
