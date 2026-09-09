/**
 * POST /api/v3/surveys/import/convert — convert a survey file (Formbricks JSON today; QSF and
 * documents as their lanes ship) into a reviewed v3 document plus import report. Multipart only,
 * 15 MB per file, never persists. Session cookie or x-api-key; readWrite access on the workspace.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ZV3EmptyQuery } from "../../schemas";
import { convertImportFile } from "./lib/convert-import";
import { IMPORT_CONVERT_BODY_LIMIT_BYTES, ZV3SurveyImportConvertBody } from "./schemas";

// File parsing needs Node buffers; nothing here is edge-compatible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withV3ApiWrapper({
  auth: "both",
  body: "multipart",
  bodyLimitBytes: IMPORT_CONVERT_BODY_LIMIT_BYTES,
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyImportConvert,
  schemas: {
    body: ZV3SurveyImportConvertBody,
    query: ZV3EmptyQuery,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    return await convertImportFile({
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
    });
  },
});
