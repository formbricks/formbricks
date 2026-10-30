import { TResponseContact, TResponseContactAttributes, TResponseData } from "@formbricks/types/responses";
import { TSurveyElementSummarySignature } from "@formbricks/types/surveys/types";

/** How many signatures the Summary tab shows as thumbnails. */
export const SIGNATURE_SUMMARY_LIMIT = 10;

interface TSignatureSummaryResponse {
  id: string;
  data: TResponseData;
  updatedAt: Date;
  contact: TResponseContact | null;
  contactAttributes: TResponseContactAttributes;
  ttc?: Record<string, number> | null;
}

type TSignatureSummary = Pick<
  TSurveyElementSummarySignature,
  "responseCount" | "signedCount" | "skippedCount" | "signatures"
>;

/**
 * Signed / skipped counts and the latest signatures of one Signature element.
 *
 * Signed is a non-empty string answer (the stored image URL, ADR 0016). Skipped is an empty answer, or no
 * answer from a respondent who reached the element (a time-to-complete entry), so a response that never
 * got that far counts as neither. `responses` arrive newest first, so the first signed ones are the latest.
 */
export const summarizeSignatureAnswers = (
  elementId: string,
  responses: readonly TSignatureSummaryResponse[]
): TSignatureSummary => {
  const signatures: TSignatureSummary["signatures"] = [];
  let signedCount = 0;
  let skippedCount = 0;

  for (const response of responses) {
    const answer = response.data[elementId];

    if (typeof answer === "string" && answer !== "") {
      signedCount++;
      if (signatures.length < SIGNATURE_SUMMARY_LIMIT) {
        signatures.push({
          id: response.id,
          updatedAt: response.updatedAt,
          value: answer,
          contact: response.contact,
          contactAttributes: response.contactAttributes,
        });
      }
    } else if (answer === "" || (answer == null && (response.ttc?.[elementId] ?? 0) > 0)) {
      skippedCount++;
    }
  }

  return { responseCount: signedCount + skippedCount, signedCount, skippedCount, signatures };
};
