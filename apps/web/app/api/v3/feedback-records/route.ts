/**
 * GET  /api/v3/feedback-records — list a dataset's feedback records, filtered and keyset-paginated.
 * POST /api/v3/feedback-records — store one record.
 *
 * Until now this surface was served by the API gateway, which authenticated the call and forwarded it
 * to the feedback store unchanged. These routes make it the application's own: same store behind it,
 * but the contract, the vocabulary and the authorization are ours, and it is covered by the v3
 * contract tests like every other operation.
 *
 * The route's job is the HTTP contract only — translate the documented query string into the
 * operations layer's parameters, and ask for v3 spelling on the way out. Authorization, the store
 * call and every error mapping live in the operations layer, which the MCP tools share.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemBadRequest } from "@/app/api/v3/lib/response";
import { createV3FeedbackRecord, listV3FeedbackRecords } from "./lib/operations";
import { V3_SERIALIZERS } from "./lib/serializers";
import {
  ZV3FeedbackRecordScopeQuery,
  ZV3FeedbackRecordsListQuery,
  respellProblemParams,
  toOperationFilters,
  toOperationSort,
  translateCreateBody,
} from "./query";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3FeedbackRecordsListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    const { workspaceId, datasetId, limit, cursor, sortBy } = parsedInput.query;

    return await listV3FeedbackRecords({
      workspaceId,
      datasetId,
      limit,
      cursor,
      ...toOperationSort(sortBy),
      ...toOperationFilters(parsedInput.query),
      authentication,
      requestId,
      instance,
      serializers: V3_SERIALIZERS,
    });
  },
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "feedbackRecord",
  // The body is validated by the operations layer, which the MCP tools share, rather than by a second
  // copy of the same schema here. `z.unknown()` still routes it through the wrapper, so the shared
  // 2 MiB cap and the malformed-JSON refusal apply.
  schemas: { query: ZV3FeedbackRecordScopeQuery, body: z.unknown() },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) => {
    const body = translateCreateBody(parsedInput.body);
    if (!body.ok) {
      return problemBadRequest(requestId, "Invalid request body", {
        instance,
        invalid_params: body.invalidParams,
      });
    }

    return respellProblemParams(
      await createV3FeedbackRecord({
        workspaceId: parsedInput.query.workspaceId,
        datasetId: parsedInput.query.datasetId,
        body: body.body,
        authentication,
        auditLog,
        requestId,
        instance,
        serializers: V3_SERIALIZERS,
      })
    );
  },
});
