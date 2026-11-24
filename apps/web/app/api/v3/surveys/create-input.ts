import { createId } from "@paralleldrive/cuid2";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import type { TSurveyCreateInput, TSurveyLanguage } from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { type TV3SurveyEmbeddedField, toLinkedEmbeddedFields } from "./embedded-fields";
import { deriveV3SurveyLanguageRequests } from "./languages";
import { type TV3CreateSurveyBody, formatV3ZodInvalidParams } from "./schemas";

/**
 * The pure half of `POST /api/v3/surveys`: a parsed v3 document becomes the survey service's create
 * input, which is checked against the service's own write schema (`ZSurveyCreateInput` +
 * `surveyRefinement`). No I/O: the languages, the owner and the app-survey fields are resolved by the
 * caller.
 *
 * Shared by the create route and by the Qualtrics import, which runs it on a draft before handing the
 * draft to the dialog — so a draft the dialog shows is one the create will accept, and the two cannot
 * drift.
 */
export function buildV3SurveyCreateInput(
  input: TV3CreateSurveyBody,
  fields: {
    languages: TSurveyLanguage[];
    createdBy: string | null;
    /**
     * ENG-6930: the document's `embeddedFields` as the rows the service writes, library links already
     * resolved to their ids. Omitted when the request sent none, so the legacy keys are the fields.
     */
    embeddedFields?: TLinkedEmbeddedField[];
    /** Applied last, in order: the app-survey distribution fields, then any caller overrides. */
    overrides?: Partial<TSurveyCreateInput>;
  }
): TSurveyCreateInput {
  return {
    name: input.name,
    type: input.type,
    status: input.status,
    metadata: input.metadata,
    showLanguageSwitch: input.showLanguageSwitch,
    autoSelectLanguage: input.autoSelectLanguage,
    welcomeCard: input.welcomeCard,
    blocks: input.blocks,
    endings: input.endings,
    hiddenFields: input.hiddenFields,
    variables: input.variables,
    // ENG-6932: no rules before the first question is stored as `null`, the column's "none".
    startLogic: input.startLogic.length > 0 ? input.startLogic : null,
    ...(fields.embeddedFields ? { embeddedFields: fields.embeddedFields } : {}),
    languages: fields.languages,
    questions: [],
    createdBy: fields.createdBy,
    ...fields.overrides,
  };
}

/**
 * What the survey service's write schema refuses in a create input, as v3 invalid params; empty when
 * it accepts it. This is what rejects, for instance, an empty label in any enabled language or two
 * choices with the same label — documents the v3 request schema admits.
 */
export function getV3SurveyCreateInputInvalidParams(input: TSurveyCreateInput): InvalidParam[] {
  const parsed = ZSurveyCreateInput.safeParse(input);
  return parsed.success ? [] : formatV3ZodInvalidParams(parsed.error, "body");
}

/**
 * The document handed to {@link getV3SurveyCreateInputInvalidParamsForDocument} is not the prepared
 * one its type suggests: an Embedded Data entry is still missing what `prepareV3SurveyCreate` settles,
 * or its library links could not be built. A server-side invariant, never the caller's input — the
 * request path prepares the document first — so it must not be reported as `invalid_params` against
 * the request. It surfaces as the generic 500 a thrown error gets, and its message reaches the log.
 */
export class V3SurveyCreateValidationDocumentNotPreparedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V3SurveyCreateValidationDocumentNotPreparedError";
  }
}

/**
 * The same check for a *dry run*: the parsed, prepared v3 document as the create would hand it to the
 * service, with nothing written. The create's language rows come from `ensureV3WorkspaceLanguages`,
 * which upserts, so placeholder rows derived from the document stand in — the write schema only reads
 * their codes, which are the ones the create would upsert. A library-linked Embedded Data field
 * likewise gets a stand-in id, because only the shape is judged here.
 *
 * `POST /api/v3/surveys/validate` with `operation: "create"` runs this after the v3 document checks
 * (ENG-7508). Without it, a dry run called a document valid that the create then refused with a 422:
 * duplicate choice labels and an unsafe CTA `buttonUrl` are documents the v3 request schema admits and
 * `surveyRefinement` rejects.
 *
 * The document must be the one `prepareV3SurveyCreate` returned; anything else throws
 * {@link V3SurveyCreateValidationDocumentNotPreparedError} rather than silently skipping a check.
 */
export function getV3SurveyCreateInputInvalidParamsForDocument(
  document: TV3CreateSurveyBody
): InvalidParam[] {
  const now = new Date();
  const languages: TSurveyLanguage[] = deriveV3SurveyLanguageRequests(document).map((request) => ({
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
    buildV3SurveyCreateInput(document, {
      languages,
      createdBy: null,
      embeddedFields: toDryRunEmbeddedFields(document.embeddedFields),
    })
  );
}

/**
 * The document's typed Embedded Data as the write input carries it, with a stand-in id per library key.
 * `undefined` only when the document has no Embedded Data at all.
 *
 * The document's type keeps every definition key optional because the request may omit them; by the
 * time this runs, `prepareV3SurveyCreate` has settled each one (`settleV3EmbeddedFieldFormats`), so an
 * entry still missing its `storageKey` means the caller skipped preparation. That throws rather than
 * dropping the fields, which would silently turn off the checks they feed.
 */
function toDryRunEmbeddedFields(
  entries: TV3CreateSurveyBody["embeddedFields"]
): TLinkedEmbeddedField[] | undefined {
  if (!entries) {
    return undefined;
  }

  const unsettledIndex = entries.findIndex((entry) => typeof entry.storageKey !== "string");
  if (unsettledIndex !== -1) {
    throw new V3SurveyCreateValidationDocumentNotPreparedError(
      `Embedded Data field at index ${unsettledIndex} has no storageKey; validate a document returned by prepareV3SurveyCreate`
    );
  }

  const settled = entries as TV3SurveyEmbeddedField[];
  const standInIds = new Map(
    settled.flatMap((entry) => (typeof entry.key === "string" ? [[entry.key, createId()] as const] : []))
  );
  const linked = toLinkedEmbeddedFields(settled, standInIds);
  if (!linked.ok) {
    // Every library key above got a stand-in id, so a prepared document cannot reach this. A future
    // caller that changes the input fails loudly here instead of losing the Embedded Data checks.
    throw new V3SurveyCreateValidationDocumentNotPreparedError(
      `Embedded Data fields could not be built for validation: ${linked.invalidParams
        .map((param) => param.reason)
        .join("; ")}`
    );
  }

  return linked.fields;
}
