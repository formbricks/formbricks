import type { TSurveyImportCreateBody } from "@/app/api/internal/surveys/imports/lib/schemas";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

export const SURVEY_IMPORTS_ENDPOINT = "/api/internal/surveys/imports";

/**
 * Create the survey a reviewed Formbricks file import became, with the references it carries
 * (`POST /api/internal/surveys/imports`, ENG-6850). `idempotencyKey` is the review's: sending the same
 * review twice creates one survey, and the server answers the repeat with the same id.
 *
 * Throws a `V3ApiError` for a refusal.
 */
export async function createSurveyFromImport(
  body: TSurveyImportCreateBody,
  idempotencyKey: string
): Promise<{ id: string }> {
  const response = await fetch(SURVEY_IMPORTS_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      // A Structured Field string, as the IETF Idempotency-Key draft writes it.
      "Idempotency-Key": `"${idempotencyKey}"`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const { data } = (await response.json()) as { data: { id: string } };
  return data;
}
