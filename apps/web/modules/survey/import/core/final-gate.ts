import { createId } from "@paralleldrive/cuid2";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { checkV3SurveyCreateInputWithoutWriting } from "@/app/api/v3/surveys/create-input";
import { type TV3SurveyEmbeddedField, toLinkedEmbeddedFields } from "@/app/api/v3/surveys/embedded-fields";
import { ZV3CreateSurveyImportDraftBody, formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { validateV3SurveyDocument } from "@/app/api/v3/surveys/validation";
import type { TSurveyImportPayload } from "./draft";

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
export function checkImportDraft(document: TSurveyImportPayload): InvalidParam[] {
  const parsed = parseDraft(document);
  if (!parsed.ok) return parsed.invalidParams;
  const invalidReferences = validateDraft(parsed.data);
  return invalidReferences.length > 0 ? invalidReferences : checkCreateInput(parsed.data);
}

/**
 * `checkImportDraft`, yielding to the event loop between its three checks with `between`. Each is
 * synchronous, the request schema's the costliest (~1 s on a 2 MB draft), so this is what keeps the
 * longest block to one check rather than all three.
 */
export async function checkImportDraftInSlices(
  document: TSurveyImportPayload,
  between: () => Promise<void>
): Promise<InvalidParam[]> {
  const parsed = parseDraft(document);
  if (!parsed.ok) return parsed.invalidParams;
  await between();
  const invalidReferences = validateDraft(parsed.data);
  if (invalidReferences.length > 0) return invalidReferences;
  await between();
  return checkCreateInput(parsed.data);
}

type TParsedDraft = ReturnType<typeof ZV3CreateSurveyImportDraftBody.parse>;

/** The v3 request schema, as the import commit parses the draft (no `visibility`: ENG-7508). */
function parseDraft(
  document: TSurveyImportPayload
): { ok: true; data: TParsedDraft } | { ok: false; invalidParams: InvalidParam[] } {
  const parsed = ZV3CreateSurveyImportDraftBody.safeParse(document);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, invalidParams: formatV3ZodInvalidParams(parsed.error, "data") };
}

/** The v3 document validation, recall ordering enforced. */
function validateDraft(data: TParsedDraft): InvalidParam[] {
  const validation = validateV3SurveyDocument(data, { mode: "enforce" });
  return validation.valid ? [] : validation.invalidParams;
}

/** The survey service's write schema, checked as the create and the validate dry run check it. */
function checkCreateInput(data: TParsedDraft): InvalidParam[] {
  return checkV3SurveyCreateInputWithoutWriting(data, toCheckedEmbeddedFields(data));
}

/**
 * The draft's typed Embedded Data (ENG-6930) as the write input carries it, as the v3 create passes it:
 * a calculated date the legacy `variables` leave out is declared there only. A library entry gets a
 * stand-in id, since only the shape is checked here; the create links the real row. `undefined` when
 * the draft has none, or an entry the create still has to complete (no storage key yet).
 */
const toCheckedEmbeddedFields = (data: TParsedDraft): TLinkedEmbeddedField[] | undefined => {
  const entries = data.embeddedFields as TV3SurveyEmbeddedField[] | undefined;
  if (!entries || entries.some((entry) => typeof entry.storageKey !== "string")) return undefined;
  const standInIds = new Map(
    entries.flatMap((entry) => (typeof entry.key === "string" ? [[entry.key, createId()] as const] : []))
  );
  const linked = toLinkedEmbeddedFields(entries, standInIds);
  return linked.ok ? linked.fields : undefined;
};

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
