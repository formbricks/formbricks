import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { type TV3ChartOperationContext, getSessionUserId } from "@/app/api/v3/charts/lib/access";
import { loggableAIError, mapV3AIError } from "@/app/api/v3/lib/ai-errors";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemBadGateway,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { CubeQueryError } from "@/modules/ee/analysis/api/lib/cube-client";
import { AI_CHART_PROMPT_ERROR_CODE } from "@/modules/ee/analysis/charts/lib/ai-chart-errors";
import { generateAIChartQuery } from "@/modules/ee/analysis/charts/lib/ai-chart-query.server";
import { getMatrixQuestions } from "@/modules/ee/analysis/charts/lib/matrix-questions";
import { validateChartQuery } from "@/modules/ee/analysis/lib/chart-query-validator";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import type { TInternalChartGenerateBody, TInternalMatrixQuestionsQuery } from "./schemas";

/**
 * The chart operations only the app's chart builder calls: describing a chart to the AI, and the
 * matrix-question picker. Session-only and unpublished (ENG-6583) — the public chart API is
 * `/api/v3/charts` — but held to the same authorization as it: read access to the workspace and to the
 * Feedback Dataset, with the Dashboards add-on.
 */

const PROMPT_NOT_CHARTABLE_REASON =
  "Name a metric, a grouping or a date range from this dataset, then try again.";
const PROMPT_TOO_FINE_REASON =
  "That period is too long to show at this level of detail. Ask for a shorter period, or for it by day, week or month.";

/** 422 for a prompt the model could not turn into a chart query the validator accepts. */
const promptNotChartable = (
  requestId: string,
  instance: string | undefined,
  reason = PROMPT_NOT_CHARTABLE_REASON
): Response =>
  problemUnprocessableContent(requestId, "The prompt could not be turned into a chart.", {
    instance,
    code: "ai_generated_payload_invalid",
    invalid_params: [{ name: "prompt", reason }],
  });

/**
 * `POST /api/internal/charts/generate` → 200 `{ data }`: an unsaved chart for a prompt — its type, query,
 * rows, labels and a suggested name — which the builder opens for review. Nothing is saved; the query it
 * runs is audited by the Cube client like every chart query, attributed to the user.
 */
export async function generateInternalChart({
  body,
  ...context
}: TV3ChartOperationContext & { body: TInternalChartGenerateBody }): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  const userId = getSessionUserId(authentication);
  if (!userId) return problemForbidden(requestId, undefined, instance);

  let organizationId = "";
  try {
    const access = await requireDashboardsAccess(
      authentication,
      body.workspaceId,
      "read",
      requestId,
      instance
    );
    if (access instanceof Response) return access;
    organizationId = access.organizationId;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      authentication,
      access,
      body.datasetId,
      "read",
      requestId,
      instance
    );
    if (refused) return refused;

    const { chartType, query, name } = await generateAIChartQuery({
      organizationId,
      workspaceId: access.workspaceId,
      feedbackDirectoryId: body.datasetId,
      userId,
      prompt: body.prompt,
    });
    // The model's query goes through the same validator as one a person or agent writes, so it is
    // held to the same bounds (including the time-bucket limit) and can be saved as it is shown.
    const validated = validateChartQuery(query);
    if (!validated.ok) {
      const tooFine = validated.issues.some((issue) => issue.code === "limit_exceeded");
      return promptNotChartable(requestId, instance, tooFine ? PROMPT_TOO_FINE_REASON : undefined);
    }
    const validatedQuery = validated.query;

    const run = await runChartQuery({
      query: validatedQuery,
      datasetId: body.datasetId,
      workspaceId: access.workspaceId,
      organizationId,
      actor: { type: "user", id: userId },
      source: "internal.charts.generate",
    });

    return successResponse(
      {
        chartType,
        query: validatedQuery,
        data: run.rows,
        ...(run.optionLabels ? { optionLabels: run.optionLabels } : {}),
        ...(run.fieldLabels ? { fieldLabels: run.fieldLabels } : {}),
        // Prefills the chart-name input (only when the user hasn't typed a name).
        ...(name ? { suggestedName: name } : {}),
      },
      { requestId }
    );
  } catch (error) {
    if (error instanceof InvalidInputError && error.message === AI_CHART_PROMPT_ERROR_CODE) {
      return promptNotChartable(requestId, instance);
    }
    if (error instanceof CubeQueryError) {
      return problemBadGateway(
        requestId,
        "The generated chart could not be run. Try again shortly.",
        instance
      );
    }

    const aiResponse = mapV3AIError(error, {
      requestId,
      instance,
      workspaceId: body.workspaceId,
      organizationId,
      operation: "charts.generate",
    });
    if (aiResponse) return aiResponse;

    // Name, frames and provider status only: the message can repeat the prompt or the model's output.
    log.error({ ...loggableAIError(error) }, "Failed to generate a chart from a prompt");
    return problemBadGateway(
      requestId,
      "The AI provider could not generate a chart. Try again or add more detail.",
      instance
    );
  }
}

/**
 * `GET /api/internal/matrix-questions?workspaceId=…&datasetId=…` → 200 `{ data }`: the matrix questions a
 * Feedback Dataset holds, for the matrix chart's "pick a question" setup.
 */
export async function listInternalMatrixQuestions({
  query,
  ...context
}: TV3ChartOperationContext & { query: TInternalMatrixQuestionsQuery }): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const log = logger.withContext({ requestId, workspaceId: query.workspaceId });

  try {
    const access = await requireDashboardsAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      authentication,
      access,
      query.datasetId,
      "read",
      requestId,
      instance
    );
    if (refused) return refused;

    return successResponse(await getMatrixQuestions(access.workspaceId, query.datasetId), { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.matrixQuestions" });
  }
}
