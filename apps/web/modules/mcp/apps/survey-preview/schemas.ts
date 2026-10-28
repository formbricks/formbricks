import { z } from "zod";
import { mcpToolOutput } from "../../tools/output-schemas";

/**
 * The survey as `get_survey` returns it. Loose on purpose: the full contract lives with the v3 operation,
 * and this schema only has to describe what the view and a client can rely on.
 */
export const ZShowSurveyData = z
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

export const ZMcpShowSurveyOutput = mcpToolOutput(ZShowSurveyData);
