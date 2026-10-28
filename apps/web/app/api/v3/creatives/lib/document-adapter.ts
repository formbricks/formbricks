import "server-only";
import { logger } from "@formbricks/logger";
import {
  type TV3DestructiveChange,
  type TV3DocumentAdapter,
  type TV3DocumentPullParams,
  type TV3DocumentPushParams,
  type TV3DocumentPushResult,
  buildDocumentEnvelope,
  diffDocuments,
  problemDestructiveChange,
  problemStaleDocument,
} from "@/app/api/v3/documents/lib/envelope";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { TCreativeState } from "@/modules/ee/creatives/lib/creative";
import { toCreativeState } from "@/modules/ee/creatives/lib/record";
import type { TCreativeRecord } from "@/modules/ee/creatives/lib/repository";
import {
  CreativeChangedError,
  CreativeInvalidError,
  type TCreativeChangeReview,
  replaceCreativeState,
} from "@/modules/ee/creatives/lib/service";
import { applyCreativePatch, validateCreativeState } from "@/modules/ee/creatives/lib/write-rules";
import { getDestructiveCreativeChanges } from "./document-destructive";
import { ZV3CreativeDocument, toCreativeDocument, toCreativeReplacePatch } from "./document-schema";
import { assertCustomCssWrite, auditChange, loadAuthorizedCreative, mapWriteError } from "./operations";

/**
 * Pull and push for creatives (ADR 0015). Both go through the operations' own access check, so a push is
 * an `update`: it needs `readWrite` on the workspace and the full licence (in wind-down it answers the same
 * 403 `creatives_not_entitled` as a PATCH that changes anything but the status), and an id from another
 * workspace answers like an unknown one. The write is `updateCreative`'s: the creative is read under its
 * row lock, the precondition compared there, the plan validated with the PATCH's own rules and the
 * references checked in the same transaction.
 */

/** A push that would remove data and was not confirmed; thrown from inside the write, answered as a 409. */
class CreativeDestructiveChangeError extends Error {
  constructor(readonly changes: TV3DestructiveChange[]) {
    super("The document would remove data");
    this.name = "CreativeDestructiveChangeError";
  }
}

const documentLocation = (creativeId: string): string => `/api/v3/creatives/${creativeId}/document`;

const documentOf = (record: TCreativeRecord) => toCreativeDocument(toCreativeState(record));

const pull = async ({
  id,
  authentication,
  requestId,
  instance,
}: TV3DocumentPullParams): Promise<Response> => {
  const resolvedInstance = instance ?? documentLocation(id);
  const log = logger.withContext({ requestId, creativeId: id });

  try {
    const loaded = await loadAuthorizedCreative(
      { creativeId: id, authentication, requestId, instance: resolvedInstance },
      "get"
    );
    if ("response" in loaded) return loaded.response;
    const { record } = loaded;

    return successResponse(
      buildDocumentEnvelope(
        "creative",
        { id: record.id, workspaceId: record.workspaceId, updatedAt: record.updatedAt.toISOString() },
        documentOf(record)
      ),
      { requestId }
    );
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: resolvedInstance,
      operation: "creatives.document.pull",
    });
  }
};

const push = async (params: TV3DocumentPushParams): Promise<Response> => {
  const { id, document, expectedUpdatedAt, dryRun, confirmDestructive, authentication, requestId, auditLog } =
    params;
  const instance = params.instance ?? documentLocation(id);
  const log = logger.withContext({ requestId, creativeId: id });

  try {
    const loaded = await loadAuthorizedCreative(
      { creativeId: id, authentication, requestId, instance },
      "update"
    );
    if ("response" in loaded) return loaded.response;
    const { record, organizationId } = loaded;

    const parsed = ZV3CreativeDocument.safeParse(document);
    if (!parsed.success) {
      const invalidParams = formatZodIssues(parsed.error, "document");
      log.warn({ statusCode: 422, invalidParams }, "Creative document failed validation");
      return problemUnprocessableContent(requestId, "The creative document failed validation", {
        invalid_params: invalidParams,
        instance,
      });
    }
    const { data: pushed } = parsed;
    const patch = toCreativeReplacePatch(pushed);

    const now = new Date();
    // Planned inside the write, from the creative as stored then (see `replaceCreativeState`).
    const plan = async (previous: TCreativeState): Promise<TCreativeState> => {
      if (pushed.type !== previous.type) {
        throw new CreativeInvalidError([
          {
            name: "type",
            reason: `This creative is a ${previous.type}, and a creative's type never changes: push a ${previous.type} document.`,
          },
        ]);
      }
      const planned = applyCreativePatch(previous, patch, now);
      if (!planned.ok) throw new CreativeInvalidError(planned.invalidParams);
      // A document that changes nothing is a no-op, however the stored creative stands.
      if (diffDocuments(toCreativeDocument(previous), toCreativeDocument(planned.state)).length === 0) {
        return previous;
      }
      const problems = validateCreativeState(planned.state, previous);
      if (problems.length > 0) throw new CreativeInvalidError(problems);
      await assertCustomCssWrite(previous, planned.state, organizationId, authentication);
      return planned.state;
    };
    const review: TCreativeChangeReview = async (tx, { previous, next }) => {
      if (confirmDestructive) return;
      const changes = await getDestructiveCreativeChanges({
        tx,
        creativeId: record.id,
        workspaceId: record.workspaceId,
        previous,
        next,
      });
      if (changes.length > 0) throw new CreativeDestructiveChangeError(changes);
    };

    const { before, next, after } = await replaceCreativeState({
      creativeId: record.id,
      workspaceId: record.workspaceId,
      expectedUpdatedAt: new Date(expectedUpdatedAt),
      surveyIdToLink: patch.destination?.type === "survey" ? patch.destination.surveyId : null,
      plan,
      review,
      dryRun,
    });

    const nextDocument = toCreativeDocument(next);
    const changes = diffDocuments(toCreativeDocument(toCreativeState(before)), nextDocument);
    const stored = after ?? before;

    // Only a push that wrote something is an update to record: a dry run or an unchanged document is not.
    if (after && !dryRun) auditChange(auditLog, organizationId, { before, after }, now);
    else skipV3AuditLog(auditLog);

    const result: TV3DocumentPushResult = {
      envelope: buildDocumentEnvelope(
        "creative",
        { id: stored.id, workspaceId: stored.workspaceId, updatedAt: stored.updatedAt.toISOString() },
        after ? documentOf(after) : nextDocument
      ),
      dryRun,
      changes,
    };
    return successResponse(result, { requestId });
  } catch (error) {
    if (error instanceof CreativeDestructiveChangeError) {
      log.warn({ statusCode: 409, changes: error.changes }, "Creative document push would remove data");
      return problemDestructiveChange(requestId, error.changes, instance);
    }
    if (error instanceof CreativeChangedError) {
      log.warn({ statusCode: 409 }, "Creative document push is stale");
      return problemStaleDocument(
        requestId,
        expectedUpdatedAt,
        error.currentUpdatedAt.toISOString(),
        instance
      );
    }
    return mapWriteError(error, { log, requestId, instance, operation: "creatives.document.push" });
  }
};

export const creativeDocumentAdapter: TV3DocumentAdapter = {
  kind: "creative",
  targetType: "creative",
  pull,
  push,
};
