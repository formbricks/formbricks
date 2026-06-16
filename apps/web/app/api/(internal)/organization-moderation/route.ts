import { NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { isModerationRequestAuthorized } from "@/modules/organization-moderation/lib/auth";
import {
  ConfirmationMismatchError,
  deleteOrganizationBySurveyId,
  getOrganizationContextBySurveyId,
  suspendOrganizationBySurveyId,
  unsuspendOrganizationBySurveyId,
} from "@/modules/organization-moderation/lib/service";

export const dynamic = "force-dynamic";

const ZPostBody = z.object({
  surveyId: z.string().min(1),
  action: z.enum(["suspend", "unsuspend"]),
  reason: z.string().trim().max(1000).optional(),
});

const ZDeleteBody = z.object({
  surveyId: z.string().min(1),
  // The operator must echo back the organization id resolved via GET. This is the
  // safety interlock preventing a single survey id from deleting the wrong org.
  confirmOrganizationId: z.string().min(1),
});

const handleError = (error: unknown): Response => {
  if (error instanceof ResourceNotFoundError) {
    return responses.notFoundResponse(error.resourceType, error.resourceId);
  }
  if (error instanceof ConfirmationMismatchError) {
    return responses.badRequestResponse(error.message);
  }
  logger.error(error, "Organization moderation request failed");
  return responses.internalServerErrorResponse("Something went wrong");
};

export const GET = async (request: NextRequest): Promise<Response> => {
  if (!isModerationRequestAuthorized(request.headers)) {
    return responses.notAuthenticatedResponse();
  }

  const surveyId = request.nextUrl.searchParams.get("surveyId")?.trim();
  if (!surveyId) {
    return responses.badRequestResponse("Missing required query parameter: surveyId");
  }

  try {
    const summary = await getOrganizationContextBySurveyId(surveyId);
    return responses.successResponse(summary);
  } catch (error) {
    return handleError(error);
  }
};

export const POST = async (request: NextRequest): Promise<Response> => {
  if (!isModerationRequestAuthorized(request.headers)) {
    return responses.notAuthenticatedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return responses.badRequestResponse("Invalid JSON body");
  }

  const parsed = ZPostBody.safeParse(body);
  if (!parsed.success) {
    return responses.badRequestResponse("Invalid request body", {
      issues: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  try {
    const { surveyId, action, reason } = parsed.data;
    const summary =
      action === "suspend"
        ? await suspendOrganizationBySurveyId(surveyId, reason)
        : await unsuspendOrganizationBySurveyId(surveyId);
    return responses.successResponse(summary);
  } catch (error) {
    return handleError(error);
  }
};

export const DELETE = async (request: NextRequest): Promise<Response> => {
  if (!isModerationRequestAuthorized(request.headers)) {
    return responses.notAuthenticatedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return responses.badRequestResponse("Invalid JSON body");
  }

  const parsed = ZDeleteBody.safeParse(body);
  if (!parsed.success) {
    return responses.badRequestResponse("Invalid request body", {
      issues: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  try {
    const { surveyId, confirmOrganizationId } = parsed.data;
    const summary = await deleteOrganizationBySurveyId(surveyId, confirmOrganizationId);
    return responses.successResponse({ ...summary, deleted: true });
  } catch (error) {
    return handleError(error);
  }
};
