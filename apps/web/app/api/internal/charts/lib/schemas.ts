import { z } from "zod";
import { AI_CHART_PROMPT_MAX_LENGTH } from "@/modules/ee/analysis/charts/lib/ai-chart-prompts";

/** `POST /api/internal/charts/generate`: a chart described in words, for one Feedback Dataset. */
export const ZInternalChartGenerateBody = z
  .object({
    workspaceId: z.cuid2(),
    datasetId: z.cuid2(),
    prompt: z.string().trim().min(1).max(AI_CHART_PROMPT_MAX_LENGTH),
  })
  .strict();
export type TInternalChartGenerateBody = z.infer<typeof ZInternalChartGenerateBody>;

/** `GET /api/internal/matrix-questions`: the matrix questions one Feedback Dataset holds. */
export const ZInternalMatrixQuestionsQuery = z
  .object({ workspaceId: z.cuid2(), datasetId: z.cuid2() })
  .strict();
export type TInternalMatrixQuestionsQuery = z.infer<typeof ZInternalMatrixQuestionsQuery>;
