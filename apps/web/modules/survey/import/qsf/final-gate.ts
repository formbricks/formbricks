import { createId } from "@paralleldrive/cuid2";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import {
  buildV3SurveyCreateInput,
  getV3SurveyCreateInputInvalidParams,
} from "@/app/api/v3/surveys/create-input";
import { deriveV3SurveyLanguageRequests } from "@/app/api/v3/surveys/languages";
import { ZV3CreateSurveyBody, formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { validateV3SurveyDocument } from "@/app/api/v3/surveys/validation";
import type { TQsfDraftDocument } from "./assemble";

/**
 * The final gate on an import draft: everything `POST /api/v3/surveys` will check without a database,
 * so a draft the dialog shows is one the create accepts.
 *
 * - the v3 request schema, as the create parses it;
 * - the v3 document validation with recall ordering **enforced** — the create runs it in `skip` mode,
 *   which would let a forward recall through into a survey the editor then flags;
 * - the survey service's write schema (`ZSurveyCreateInput` + `surveyRefinement`), through the same
 *   helper the create uses, with placeholder language rows where the create would upsert real ones.
 *
 * Returns the problems, empty when there are none. Their names are paths (`blocks.2.elements.0.…`), so
 * the pipeline can drop the element at fault.
 */
export function checkQsfDraft(document: TQsfDraftDocument): InvalidParam[] {
  const parsed = ZV3CreateSurveyBody.safeParse(document);
  if (!parsed.success) return formatV3ZodInvalidParams(parsed.error, "data");

  const validation = validateV3SurveyDocument(parsed.data, { mode: "enforce" });
  if (!validation.valid) return validation.invalidParams;

  const now = new Date();
  const languages: TSurveyLanguage[] = deriveV3SurveyLanguageRequests(parsed.data).map((request) => ({
    language: {
      id: createId(),
      code: request.code,
      alias: null,
      workspaceId: document.workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    default: request.default,
    enabled: request.enabled,
  }));

  return getV3SurveyCreateInputInvalidParams(
    buildV3SurveyCreateInput(parsed.data, { languages, createdBy: null })
  );
}

const ELEMENT_PATH = /^blocks\.(\d+)\.elements\.(\d+)(?:\.|$)/;

/**
 * The element each problem is about, as `[blockIndex, elementIndex]`, or `null` when any problem is
 * not about one element (an ending, the hidden fields, a block's own settings).
 */
export function elementsAtFault(invalidParams: InvalidParam[]): [number, number][] | null {
  const elements: [number, number][] = [];
  for (const param of invalidParams) {
    const match = ELEMENT_PATH.exec(param.name);
    if (!match) return null;
    elements.push([Number(match[1]), Number(match[2])]);
  }
  return elements;
}
