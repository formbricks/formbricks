/**
 * POST /api/v3/surveys/import — import a `.formbricks.json` export or a raw v3 survey document into a
 * workspace. `options.dryRun` returns the resolved document and report without writing.
 * Session cookie or x-api-key; readWrite access on the target workspace.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "../schemas";
import { importV3Survey } from "./lib/import-survey";
import { ZV3SurveyImportBody } from "./schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: ZV3SurveyImportBody,
    query: ZV3EmptyQuery,
  },
  // No wrapper-level audit: a dry run writes nothing, so the `created` row is queued by the
  // handler only when a survey was actually created.
  handler: async ({ req, authentication, parsedInput, requestId, instance }) => {
    return await importV3Survey({
      req,
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
    });
  },
});
