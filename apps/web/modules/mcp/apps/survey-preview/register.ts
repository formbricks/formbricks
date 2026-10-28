import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getV3Survey } from "@/app/api/v3/surveys/lib/operations";
import { WEBAPP_URL } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../../auth";
import { responseToMcpToolResult } from "../../errors";
import { registerScopedTool } from "../../tools/guard-scopes";
import { mcpToolOutput } from "../../tools/output-schemas";
import { type TMcpGetSurveyInput, ZMcpGetSurveyInput } from "../../tools/schemas";
import { registerMcpAppResource } from "../register-app-resource";
import { buildMcpAppToolMeta } from "../tool-meta";
import { loadSurveyPreviewMeta } from "./load-preview-meta";
import { getSurveyPreviewUiMeta } from "./render-payload";
import { buildShowSurveySummary } from "./summary";

/**
 * The survey as `get_survey` returns it. Loose on purpose: the full contract lives with the v3 operation,
 * and this schema only has to describe what the view and a client can rely on.
 */
const ZShowSurveyData = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    type: z.enum(["link", "app"]),
    status: z.string(),
    updatedAt: z.string(),
    defaultLanguage: z.string(),
  })
  .loose();

const ZMcpShowSurveyOutput = mcpToolOutput(ZShowSurveyData);

export const SHOW_SURVEY_DESCRIPTION = [
  "Show one Formbricks survey to the user in an interactive view: a readable outline (questions, logic, endings, settings) and a Try it tab that runs the real respondent renderer.",
  "Nothing the user enters in the preview is stored or sent. Use it to let the user look at a survey before it goes live, after you create or change one, or when they ask what a survey contains.",
  "The result carries the same survey as get_survey in `structuredContent`; the view's render data stays out of your context.",
  "Reading the survey in order to edit it is still get_survey's job.",
].join(" ");

export function registerSurveyPreviewApp(server: McpServer): void {
  registerMcpAppResource(server, {
    view: "survey-preview",
    title: "Survey preview",
    description: "Review a survey and try it before it goes live.",
    getUiMeta: () => getSurveyPreviewUiMeta(WEBAPP_URL, getPublicDomain()),
  });

  registerScopedTool(
    server,
    "show_survey",
    {
      title: "Show survey",
      description: SHOW_SURVEY_DESCRIPTION,
      inputSchema: ZMcpGetSurveyInput,
      outputSchema: ZMcpShowSurveyOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: buildMcpAppToolMeta("survey-preview"),
    },
    ["surveys:read"],
    async (input: TMcpGetSurveyInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);

      // The v3 read first, always: authorization, survey visibility and tenant scoping are its. Nothing
      // below loads a survey that this call did not just answer for.
      const response = await getV3Survey({
        surveyId: input.surveyId,
        lang: input.lang,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });
      const result = await responseToMcpToolResult(response, requestId);
      if (result.isError) {
        return result;
      }

      const data = (result.structuredContent as { data?: { workspaceId?: string } } | undefined)?.data;
      const preview = await loadSurveyPreviewMeta({
        surveyId: input.surveyId,
        expectedWorkspaceId: data?.workspaceId,
        requestId,
      });

      return {
        ...result,
        content: [{ type: "text", text: buildShowSurveySummary(data) }],
        ...(preview ? { _meta: { formbricks: preview } } : {}),
      };
    }
  );
}
