/**
 * /api/v3/surveys/templates - product-internal trusted template survey creation.
 * Session cookie only; templates are reconstructed server-side before creating a survey.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3TrustedTemplateCreateBody, createTrustedTemplateSurveyResponse } from "./lib/template-create";

export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: {
    body: ZV3TrustedTemplateCreateBody,
  },
  action: "created",
  targetType: "survey",
  handler: async ({ authentication, auditLog, parsedInput, requestId, instance }) => {
    return await createTrustedTemplateSurveyResponse({
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});
