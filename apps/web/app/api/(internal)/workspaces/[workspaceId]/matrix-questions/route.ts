import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { getMatrixQuestions } from "@/modules/ee/analysis/charts/lib/matrix-questions";
import { checkFeedbackDirectoryAccess, checkWorkspaceAccess } from "@/modules/ee/analysis/lib/access";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * `GET /api/workspaces/{workspaceId}/matrix-questions?feedbackDirectoryId=…` — the matrix questions a
 * feedback directory holds, for the matrix chart's "pick a question" setup.
 *
 * Internal rather than `/api/v3`: the chart builder is the only caller and the shape exists to fill one
 * picker, so it carries no OpenAPI entry and no compatibility promise. Session-only, and gated exactly
 * like the chart queries it sets up: read access to the workspace and to the directory, with dashboards
 * enabled for the organization.
 */

const paramsSchema = z.object({
  workspaceId: z.cuid2(),
});

const querySchema = z.object({
  feedbackDirectoryId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: {
    params: paramsSchema,
    query: querySchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const { workspaceId } = parsedInput.params;
    const { feedbackDirectoryId } = parsedInput.query;

    const userId = authentication && "user" in authentication ? authentication.user?.id : undefined;
    if (!userId) {
      return problemForbidden(requestId, undefined, instance);
    }

    // Each check throws an AuthorizationError / OperationNotAllowedError, which the wrapper answers
    // with a 403 — a 404 for a workspace the caller cannot see would confirm the id is real.
    const { organizationId } = await checkWorkspaceAccess(userId, workspaceId, "read");
    if (!(await getIsDashboardsEnabled(organizationId))) {
      throw new OperationNotAllowedError("Dashboards are not enabled for this organization");
    }
    await checkFeedbackDirectoryAccess({
      feedbackDirectoryId,
      workspaceId,
      userId,
      minPermission: "read",
      source: "charts.matrixQuestions",
    });

    const questions = await getMatrixQuestions(workspaceId, feedbackDirectoryId);
    return successResponse(questions, { requestId });
  },
});
