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
  const parsed = parseDraft(document);
  if (!parsed.ok) return parsed.invalidParams;
  const invalidReferences = validateDraft(parsed.data);
  return invalidReferences.length > 0 ? invalidReferences : checkCreateInput(document, parsed.data);
}

/**
 * `checkQsfDraft`, yielding to the event loop between its three checks with `between`. Each is
 * synchronous, the request schema's the costliest (~1 s on a 2 MB draft), so this is what keeps the
 * longest block to one check rather than all three.
 */
export async function checkQsfDraftInSlices(
  document: TQsfDraftDocument,
  between: () => Promise<void>
): Promise<InvalidParam[]> {
  const parsed = parseDraft(document);
  if (!parsed.ok) return parsed.invalidParams;
  await between();
  const invalidReferences = validateDraft(parsed.data);
  if (invalidReferences.length > 0) return invalidReferences;
  await between();
  return checkCreateInput(document, parsed.data);
}

type TParsedDraft = ReturnType<typeof ZV3CreateSurveyBody.parse>;

/** The v3 request schema, as the create parses the body. */
function parseDraft(
  document: TQsfDraftDocument
): { ok: true; data: TParsedDraft } | { ok: false; invalidParams: InvalidParam[] } {
  const parsed = ZV3CreateSurveyBody.safeParse(document);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, invalidParams: formatV3ZodInvalidParams(parsed.error, "data") };
}

/** The v3 document validation, recall ordering enforced. */
function validateDraft(data: TParsedDraft): InvalidParam[] {
  const validation = validateV3SurveyDocument(data, { mode: "enforce" });
  return validation.valid ? [] : validation.invalidParams;
}

/** The survey service's write schema, with placeholder language rows. */
function checkCreateInput(document: TQsfDraftDocument, data: TParsedDraft): InvalidParam[] {
  const now = new Date();
  const languages: TSurveyLanguage[] = deriveV3SurveyLanguageRequests(data).map((request) => ({
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

  return getV3SurveyCreateInputInvalidParams(buildV3SurveyCreateInput(data, { languages, createdBy: null }));
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
