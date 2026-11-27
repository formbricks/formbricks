import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listLanguageSurveysOperation } from "../../lib/operations";
import { ZLanguageIdParams } from "../../schemas";

/** `GET /api/internal/languages/{languageId}/surveys`: the surveys (the caller may see) using a language. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZLanguageIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listLanguageSurveysOperation({
      authentication,
      languageId: parsedInput.params.languageId,
      requestId,
      instance,
    }),
});
