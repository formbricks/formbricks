/**
 * GET    /api/v3/feedback-records/{feedbackRecordId} — read one record.
 * PATCH  /api/v3/feedback-records/{feedbackRecordId} — correct one record.
 * DELETE /api/v3/feedback-records/{feedbackRecordId} — delete one record permanently.
 *
 * `workspaceId` is required rather than inferred from the record: it is the container the caller's
 * permissions are checked against, and the operations layer answers a record outside it with a plain
 * 403 rather than a 404, so record ids cannot be probed across datasets.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemBadRequest } from "@/app/api/v3/lib/response";
import { deleteV3FeedbackRecord, getV3FeedbackRecord, updateV3FeedbackRecord } from "../lib/operations";
import { V3_SERIALIZERS } from "../lib/serializers";
import {
  ZV3FeedbackRecordIdParams,
  ZV3FeedbackRecordScopeQuery,
  respellProblemParams,
  translateUpdateBody,
} from "../query";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3FeedbackRecordIdParams, query: ZV3FeedbackRecordScopeQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3FeedbackRecord({
      workspaceId: parsedInput.query.workspaceId,
      datasetId: parsedInput.query.datasetId,
      feedbackRecordId: parsedInput.params.feedbackRecordId,
      authentication,
      requestId,
      instance,
      serializers: V3_SERIALIZERS,
    }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "feedbackRecord",
  schemas: {
    params: ZV3FeedbackRecordIdParams,
    query: ZV3FeedbackRecordScopeQuery,
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) => {
    const body = translateUpdateBody(parsedInput.body);
    if (!body.ok) {
      return problemBadRequest(requestId, "Invalid request body", {
        instance,
        invalid_params: body.invalidParams,
      });
    }

    return respellProblemParams(
      await updateV3FeedbackRecord({
        workspaceId: parsedInput.query.workspaceId,
        datasetId: parsedInput.query.datasetId,
        feedbackRecordId: parsedInput.params.feedbackRecordId,
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

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "feedbackRecord",
  schemas: { params: ZV3FeedbackRecordIdParams, query: ZV3FeedbackRecordScopeQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3FeedbackRecord({
      workspaceId: parsedInput.query.workspaceId,
      datasetId: parsedInput.query.datasetId,
      feedbackRecordId: parsedInput.params.feedbackRecordId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
