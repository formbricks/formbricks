/**
 * Client-safe helpers for a survey's upload elements: File upload and Signature.
 *
 * Split out of `./utils` — which is `server-only` because it reaches for `WEBAPP_URL` and the public
 * domain — so a client component can ask "does this survey collect files?" without dragging server
 * config into the bundle. Same arrangement as `./url-helpers`, and `./utils` re-exports from here so
 * existing server-side imports keep working.
 */
import type { TAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  TSurveyElementTypeEnum,
  TSurveyFileUploadElement,
  TSurveySignatureElement,
} from "@formbricks/types/surveys/elements";

/**
 * The minimum an element must expose to be recognised as a file upload or a signature.
 *
 * Structural rather than `TSurveyQuestion[]`: that type is deprecated (v1 back-compat only), and this
 * shape accepts both it and `TSurveyElement[]` without importing the deprecated union.
 */
export type TFileUploadCandidate = { id: string; type: string };

/** An element whose answer holds storage URLs. */
export type TSurveyUploadElement = TSurveyFileUploadElement | TSurveySignatureElement;

/**
 * The only extension a Signature upload may have: the runtime always exports the signature as a PNG, so
 * anything else under a Signature element is not a signature.
 */
export const SIGNATURE_ALLOWED_FILE_EXTENSIONS = ["png"] as const satisfies readonly TAllowedFileExtension[];

/**
 * Every upload element in a survey: File upload and Signature.
 *
 * A survey holds its elements in `blocks` or in legacy `questions`, so both shapes are read: keying off
 * one alone silently misses the other. Callers that must tell the two apart read `type`: a Signature
 * answer is one URL string, a File upload answer an array of them.
 */
export const getSurveyFileUploadConfigs = ({
  blocks,
  questions,
}: {
  blocks?: TSurveyBlock[] | null;
  questions?: readonly TFileUploadCandidate[] | null;
}): TSurveyUploadElement[] => {
  const isUploadElement = (element: { type: string }) =>
    element.type === TSurveyElementTypeEnum.FileUpload || element.type === TSurveyElementTypeEnum.Signature;

  return [
    ...(blocks ?? []).flatMap((block) => block.elements).filter(isUploadElement),
    // The element and legacy question enums spell both types the same (`"fileUpload"`, `"signature"`),
    // so the element enum covers the legacy shape too.
    ...(questions ?? []).filter(isUploadElement),
  ] as TSurveyUploadElement[];
};
