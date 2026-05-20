import type { InvalidParam } from "@/app/api/v3/lib/response";
import { validateV3SurveyReferences } from "./reference-validation";
import type { TV3SurveyDocument } from "./schemas";

export type TV3SurveyDocumentValidationResult =
  | { valid: true; invalidParams: [] }
  | { valid: false; invalidParams: InvalidParam[] };

export function validateV3SurveyDocument(document: TV3SurveyDocument): TV3SurveyDocumentValidationResult {
  const referenceValidation = validateV3SurveyReferences({
    blocks: document.blocks,
    endings: document.endings,
    hiddenFields: document.hiddenFields,
    metadata: document.metadata,
    variables: document.variables,
    welcomeCard: document.welcomeCard,
  });

  if (!referenceValidation.ok) {
    return {
      valid: false,
      invalidParams: referenceValidation.invalidParams,
    };
  }

  return { valid: true, invalidParams: [] };
}
