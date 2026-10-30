import "server-only";
import { logger } from "@formbricks/logger";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  problemBadRequest,
  problemIdempotencyKeyInUse,
  problemIdempotencyKeyReused,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId, mapV3SurveyCreateError } from "@/app/api/v3/surveys/lib/operations";
import { capturePostHogEvent } from "@/lib/posthog";
import { createSurveyFromFormbricksFile } from "@/modules/survey/formbricks-file/import";
import { toRefusalResponse } from "@/modules/survey/import/core/errors";
import {
  SURVEY_IMPORT_IDEMPOTENCY_IN_FLIGHT_MS,
  SURVEY_IMPORT_IDEMPOTENCY_KEY_MAX_CHARS,
} from "@/modules/survey/import/limits";
import { claimSurveyImportIdempotencyKey, fingerprintSurveyImportRequest } from "./idempotency";
import type { TSurveyImportCreateBody } from "./schemas";

const OPERATION = "surveys.imports.create";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/**
 * The `Idempotency-Key` header: a Structured Field string as the IETF draft writes it (`"…"`), or the
 * bare token many clients send. Printable ASCII, 1 to 255 characters. `null` when it is missing or
 * not one.
 */
export const parseIdempotencyKey = (header: string | null): string | null => {
  if (header === null) return null;
  const trimmed = header.trim();
  const key =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
  const isPrintableAscii = /^[\x21-\x7e]+$/.test(key);
  return isPrintableAscii && key.length <= SURVEY_IMPORT_IDEMPOTENCY_KEY_MAX_CHARS ? key : null;
};

const surveyLocation = (surveyId: string): string => `/api/v3/surveys/${surveyId}`;

const created = (surveyId: string, requestId: string): Response =>
  createdResponse({ id: surveyId }, { requestId, location: surveyLocation(surveyId) });

/**
 * `POST /api/internal/surveys/imports` (ENG-6850): create the survey a reviewed Formbricks file import
 * became, with the references it needs, in one transaction. The body is what the preview returned —
 * the draft and the file's references — and is read, checked and resolved again: nothing the client
 * resolved is trusted.
 *
 * Idempotent per `Idempotency-Key` (see `idempotency.ts`): a repeat of a finished request gets the
 * same 201 and creates nothing; the same key with another body is a 422, and with one still running a
 * 409. The audit entry is the wrapper's `created` on the survey, written once the create committed; a
 * replay writes none, since it created nothing.
 */
export async function createSurveyImport({
  req,
  authentication,
  body,
  requestId,
  instance,
  auditLog,
}: {
  req: Request;
  authentication: TV3Authentication;
  body: TSurveyImportCreateBody;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  const idempotencyKey = parseIdempotencyKey(req.headers.get(IDEMPOTENCY_KEY_HEADER));
  if (!idempotencyKey) {
    return problemBadRequest(requestId, "An Idempotency-Key header is required", {
      instance,
      invalid_params: [
        {
          name: IDEMPOTENCY_KEY_HEADER,
          reason: `Expected 1 to ${SURVEY_IMPORT_IDEMPOTENCY_KEY_MAX_CHARS} printable ASCII characters`,
        },
      ],
    });
  }

  const access = await requireV3WorkspaceAccess(
    authentication,
    body.workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  const { workspaceId, organizationId } = access;

  // Session-only route: there is always a user, and keys are scoped to them.
  const userId = getSessionUserId(authentication) ?? "";
  const claim = await claimSurveyImportIdempotencyKey({
    userId,
    idempotencyKey,
    fingerprint: fingerprintSurveyImportRequest(body),
  });

  switch (claim.kind) {
    case "mismatch":
      return problemIdempotencyKeyReused(requestId, instance);
    case "in_flight":
      return problemIdempotencyKeyInUse(
        requestId,
        instance,
        Math.ceil(SURVEY_IMPORT_IDEMPOTENCY_IN_FLIGHT_MS / 1000)
      );
    case "replay":
      skipV3AuditLog(auditLog);
      return created(claim.surveyId, requestId);
    default:
      break;
  }

  let surveyId: string;
  try {
    const survey = await createSurveyFromFormbricksFile({
      body,
      workspaceId,
      organizationId,
      authentication,
      requestId,
    });
    surveyId = survey.id;
  } catch (error) {
    if (claim.kind === "claimed") {
      await claim.release().catch((releaseError: unknown) => {
        log.warn({ error: releaseError }, "Survey import could not give its Idempotency-Key back");
      });
    }
    return (
      toRefusalResponse(error, requestId, instance) ??
      mapV3SurveyCreateError(error, { log, requestId, instance })
    );
  }

  if (claim.kind === "claimed") {
    // The survey exists now: a failure here must not answer as if nothing was created.
    await claim.complete(surveyId).catch((completeError: unknown) => {
      log.warn({ error: completeError }, "Survey import could not record its Idempotency-Key");
    });
  }

  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = surveyId;
    auditLog.newObject = { id: surveyId, workspaceId, createdFrom: "import" };
  }
  capturePostHogEvent(
    userId,
    "survey_created",
    {
      survey_id: surveyId,
      organization_id: organizationId,
      workspace_id: workspaceId,
      created_from: "import",
    },
    { organizationId, workspaceId }
  );
  log.info({ operation: OPERATION, surveyId }, "Survey imported");

  return created(surveyId, requestId);
}
