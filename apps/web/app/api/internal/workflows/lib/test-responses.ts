import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  type TWorkflowIdInput,
  WORKFLOW_TRIGGERS,
  ZResponseCompletedTriggerConfig,
} from "@formbricks/workflows";
import {
  WorkflowForbiddenError,
  WorkflowInvalidStateError,
  loadAndAuthorize,
  toProblemResponse,
} from "@formbricks/workflows/server";
import {
  type TKeysetCursor,
  buildKeysetPage,
  computeFilterFingerprint,
  decodeKeysetCursor,
  keysetOrderBy,
  keysetPagePredicate,
} from "@/app/api/v3/lib/keyset-cursor";
import { problemBadRequest, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import {
  buildIsSurveyHidden,
  buildWorkflowApiContext,
  workflowsService,
} from "@/app/api/v3/workflows/lib/context";
import {
  TEST_RESPONSES_PAGE_SIZE,
  type TWorkflowTestResponse,
  getElementIdsFromBlocks,
  getFirstAnswerText,
} from "@/modules/ee/workflows/lib/test-run-responses";

const CURSOR_KIND = "workflow-test-responses";
const CURSOR_SORT = "-createdAt";

const sortColumn = Prisma.sql`r."created_at"`;
const idColumn = Prisma.sql`r."id"`;

/**
 * `GET /api/internal/workflows/{workflowId}/test-responses`: the responses of a Response completed
 * workflow's trigger survey, newest first, 20 a page, for the Test run picker (ADR 0049). Write access,
 * like the Test run itself. The survey comes from the workflow's draft, never from the caller, and must
 * be in the workflow's workspace and readable by the caller. Each row carries only what the picker
 * shows: when, completed or partial, the ending, and the first answer as text.
 */
export const listWorkflowTestResponses = async ({
  authentication,
  requestId,
  instance,
  params,
  cursor: rawCursor,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  params: TWorkflowIdInput;
  cursor: string | null;
}): Promise<Response> => {
  const ctx = buildWorkflowApiContext(authentication, requestId, instance);
  try {
    const workflow = await loadAndAuthorize(workflowsService, ctx, params.workflowId, "readWrite");
    if (workflow instanceof Response) return workflow;

    const trigger = workflow.definition.trigger;
    const config =
      trigger?.triggerType === WORKFLOW_TRIGGERS.RESPONSE_COMPLETED
        ? ZResponseCompletedTriggerConfig.safeParse(trigger.config)
        : null;
    if (!config?.success) {
      throw new WorkflowInvalidStateError("Only a Response completed trigger with a survey has responses.");
    }
    const { surveyId } = config.data;
    const workspaceId = workflow.workspaceId;

    const fp = computeFilterFingerprint({ workflowId: workflow.id, surveyId });
    let cursor: TKeysetCursor | null = null;
    if (rawCursor !== null) {
      try {
        cursor = decodeKeysetCursor(rawCursor, { kind: CURSOR_KIND, sortBy: CURSOR_SORT, fp });
      } catch (error) {
        if (!(error instanceof InvalidInputError)) throw error;
        return problemBadRequest(requestId, error.message, {
          instance,
          invalid_params: [{ name: "cursor", reason: error.message }],
        });
      }
    }

    const survey = await prisma.survey.findUnique({
      where: { id_workspaceId: { id: surveyId, workspaceId } },
      select: { blocks: true },
    });
    if (!survey || (await buildIsSurveyHidden(authentication)({ workspaceId, surveyId }))) {
      throw new WorkflowForbiddenError("You cannot read this workflow's survey.");
    }

    const clauses = [Prisma.sql`r."surveyId" = ${surveyId}`];
    if (cursor) {
      clauses.push(keysetPagePredicate({ sortColumn, idColumn, direction: "desc", cursor }));
    }
    // The (surveyId, created_at, id) index answers this, page predicate included.
    const rows = await prisma.$queryRaw<
      { id: string; created_at: Date; finished: boolean; endingId: string | null; data: unknown }[]
    >`
      SELECT r."id", r."created_at", r."finished", r."endingId", r."data"
      FROM "Response" r
      WHERE ${Prisma.join(clauses, " AND ")}
      ${keysetOrderBy({ sortColumn, idColumn, direction: "desc" })}
      LIMIT ${TEST_RESPONSES_PAGE_SIZE + 1}
    `;

    const { page, nextCursor } = buildKeysetPage({
      rows,
      limit: TEST_RESPONSES_PAGE_SIZE,
      kind: CURSOR_KIND,
      sortBy: CURSOR_SORT,
      fp,
      sortValue: (row) => row.created_at,
    });
    const elementIds = getElementIdsFromBlocks(survey.blocks);
    const data: TWorkflowTestResponse[] = page.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      finished: row.finished,
      endingId: row.endingId,
      firstAnswer: getFirstAnswerText(elementIds, row.data),
    }));
    return successListResponse(data, { nextCursor }, { requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
