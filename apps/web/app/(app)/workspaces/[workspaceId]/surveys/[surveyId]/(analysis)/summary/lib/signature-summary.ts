import { TResponseContact, TResponseContactAttributes, TResponseData } from "@formbricks/types/responses";
import { TSurveyElementSummarySignature } from "@formbricks/types/surveys/types";
import { getSignatureImageSrc } from "@/modules/storage/signature-image";

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

/** What one Summary thumbnail shows: the image, or the raw text of a value that is no private storage URL. */
export type TSignatureTile = { kind: "image"; src: string } | { kind: "text"; text: string };

/**
 * The tile for one counted signature. A value that fails the storage URL check (an API client may write
 * anything) still gets a tile, as plain text and never as an `href` or `src`, so the grid shows exactly the
 * signatures the Signed count includes.
 */
export const getSignatureTile = (value: string, currentOrigin?: string): TSignatureTile => {
  const src = getSignatureImageSrc(value, currentOrigin);
  return src ? { kind: "image", src } : { kind: "text", text: value };
};
