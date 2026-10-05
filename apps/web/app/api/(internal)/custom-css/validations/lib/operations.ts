import "server-only";
import type { z } from "zod";
import { AuthorizationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { getV3AuthorizationActor, requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getSurvey } from "@/lib/survey/service";
import { compileCustomCss } from "@/modules/survey/lib/custom-css";
import { assertCustomCssAccess } from "@/modules/survey/lib/custom-css-permission";
import type { ZCustomCssValidation } from "../schemas";

export const validateCustomCss = async ({
  authentication,
  input,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  input: z.infer<typeof ZCustomCssValidation>;
  requestId: string;
  instance?: string;
}): Promise<Response> => {
  const context = await requireSessionWorkspaceAccess(
    authentication,
    input.workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (context instanceof Response) return context;
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) return problemForbidden(requestId, "Not authorized", instance);
  try {
    if (input.scope === "survey") {
      if (!(await can(actor, "survey.write", { type: "survey", id: input.surveyId })))
        return problemForbidden(requestId, "Not authorized", instance);
      const survey = await getSurvey(input.surveyId);
      if (!survey || survey.workspaceId !== context.workspaceId || survey.archivedAt)
        return problemForbidden(requestId, "Not authorized", instance);
    }
    await assertCustomCssAccess(actor, context.workspaceId, input.scope);
    return successResponse(compileCustomCss(input, input.scope));
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof OperationNotAllowedError)
      return problemForbidden(requestId, error.message, instance);
    if (error instanceof ValidationError)
      return problemUnprocessableContent(requestId, error.message, { instance });
    throw error;
  }
};
