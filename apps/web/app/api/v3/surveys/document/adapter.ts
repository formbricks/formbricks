import "server-only";
import { logger } from "@formbricks/logger";
import {
  type TV3DocumentAdapter,
  type TV3DocumentChange,
  type TV3DocumentPushResult,
  buildDocumentEnvelope,
  diffDocuments,
} from "@/app/api/v3/documents/lib/envelope";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemBadRequest, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import { getAuthorizedV3Survey } from "../authorization";
import { type TV3SurveyDocumentPushOutcome, runV3SurveyDocumentMutation } from "../lib/operations";
import { ZV3ExpectedUpdatedAt } from "../schemas";
import { V3SurveyUnsupportedShapeError, serializeV3SurveyResource } from "../serializers";
import { surveyDestructiveGuard } from "./destructive";
import {
  canonicalizeV3SurveyDocument,
  omitUnchangedDistribution,
  parseV3SurveyDocument,
  toV3SurveyDocument,
  toV3SurveyPatchInput,
} from "./schema";

/** The changes between two documents, compared by content: key order and formatting do not count. */
const diffSurveyDocuments = (
  before: Record<string, unknown>,
  after: Record<string, unknown>
): TV3DocumentChange[] =>
  diffDocuments(
    canonicalizeV3SurveyDocument(before) as Record<string, unknown>,
    canonicalizeV3SurveyDocument(after) as Record<string, unknown>
  );

const envelopeOf = (
  resource: ReturnType<typeof serializeV3SurveyResource>,
  document: Record<string, unknown>
) => buildDocumentEnvelope("survey", resource, document);

export const surveyDocumentAdapter: TV3DocumentAdapter = {
  kind: "survey",
  targetType: "survey",

  async pull({ id, authentication, requestId, instance = "" }) {
    const log = logger.withContext({ requestId, surveyId: id });

    try {
      const { survey, response, visibility } = await getAuthorizedV3Survey({
        surveyId: id,
        authentication,
        access: "read",
        requestId,
        instance,
      });
      if (response) {
        log.warn({ statusCode: response.status }, "Survey not found or not accessible");
        return response;
      }

      const resource = serializeV3SurveyResource(survey, visibility);
      return successResponse(envelopeOf(resource, toV3SurveyDocument(resource)), {
        requestId,
        cache: "private, no-store",
      });
    } catch (error) {
      if (error instanceof V3SurveyUnsupportedShapeError) {
        // Same answer a push gets for this survey, so the two never disagree about whether it is editable.
        return problemUnprocessableContent(requestId, error.message, {
          code: "stored_survey_invalid",
          instance,
          invalid_params: [{ name: "survey", reason: error.message }],
        });
      }
      return mapV3ThrownError(error, { log, requestId, instance, operation: "surveys.document.pull" });
    }
  },

  async push({
    id,
    authentication,
    requestId,
    instance = "",
    document,
    expectedUpdatedAt,
    dryRun,
    confirmDestructive,
    auditLog,
  }) {
    const precondition = ZV3ExpectedUpdatedAt.safeParse(expectedUpdatedAt);
    if (!precondition.success) {
      return problemBadRequest(requestId, "Invalid expectedUpdatedAt", {
        instance,
        invalid_params: [
          {
            name: "expectedUpdatedAt",
            reason: "Must be the ISO 8601 date-time `updatedAt` returned by the pull",
          },
        ],
      });
    }

    // The changes `buildInput` found, for the dry run (which has no stored result to diff).
    let pushedDocument: Record<string, unknown> = {};

    const respond = (outcome: TV3SurveyDocumentPushOutcome): Response => {
      const before = toV3SurveyDocument(outcome.before);
      let result: TV3DocumentPushResult;

      if (outcome.kind === "written") {
        const after = toV3SurveyDocument(outcome.after);
        result = {
          envelope: envelopeOf(outcome.after, after),
          dryRun: false,
          changes: diffSurveyDocuments(before, after),
        };
      } else if (outcome.kind === "dry_run") {
        // The document as pushed, with omitted keys reset: what the stored one will be, give or take
        // the normalisation the write applies.
        result = {
          envelope: envelopeOf(outcome.before, pushedDocument),
          dryRun: true,
          changes: diffSurveyDocuments(before, pushedDocument),
        };
      } else {
        // Nothing changed, so there is nothing to record as an update.
        skipV3AuditLog(auditLog);
        result = { envelope: envelopeOf(outcome.before, before), dryRun, changes: [] };
      }

      return successResponse(result, {
        requestId,
        cache: "private, no-store",
        ...(outcome.kind === "unchanged" ? {} : { extensions: outcome.extensions }),
      });
    };

    return runV3SurveyDocumentMutation({
      surveyId: id,
      body: document,
      authentication,
      requestId,
      instance,
      // A dry run records nothing; the pipeline only touches an audit log it is given.
      auditLog: dryRun ? undefined : auditLog,
      operation: "document.push",
      precondition: { expectedUpdatedAt: new Date(precondition.data) },
      push: {
        dryRun,
        guard: confirmDestructive ? undefined : surveyDestructiveGuard,
        respond,
      },
      buildInput: ({ survey, getResource }) => {
        const parsed = parseV3SurveyDocument(document);
        if (!parsed.ok) {
          return {
            ok: false,
            detail: "Survey document failed validation",
            invalidParams: parsed.invalidParams,
          };
        }

        const input = toV3SurveyPatchInput(parsed.document, survey.type);
        const stored = toV3SurveyDocument(getResource());
        const changes = diffSurveyDocuments(stored, input);
        if (changes.length === 0) {
          return { ok: true, unchanged: true };
        }

        pushedDocument = input;
        return {
          ok: true,
          // What is written leaves an unchanged distribution alone; `pushedDocument` keeps it, so a dry
          // run still answers the document as the caller sent it.
          input: omitUnchangedDistribution(input, stored),
          logFields: { changedPaths: changes.length },
        };
      },
    });
  },
};
