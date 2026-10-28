import { z } from "zod";
import type { TSurveyType } from "@formbricks/types/surveys/types";
import { type InvalidParam } from "@/app/api/v3/lib/response";
import { ZV3SurveyCustomCss, formatV3ZodInvalidParams } from "../schemas";
import type { serializeV3SurveyResource } from "../serializers";

/**
 * The survey document (ADR 0015): the editable state of a survey, and nothing the server owns.
 *
 * In it: the name, the translated content (metadata, welcome card, blocks, endings), the languages the
 * survey is translated into, the respondent language switches, hidden fields and variables, custom CSS
 * and, for an app survey only, `distribution` and `targeting`.
 *
 * Deliberately not in it, each with the tool or rule that owns it instead:
 *
 * - `id`, `workspaceId`, `updatedAt` are the envelope's; `createdAt` is nobody's to edit.
 * - `status` and `archivedAt` are lifecycle (publish, pause, archive and restore are their own tools), so
 *   a push can never publish or reopen a survey.
 * - `type` and `defaultLanguage` are fixed at creation. Content is keyed by the default language, which
 *   is the `languages[]` entry with `default: true`, so a push that names another one is refused.
 * - `visibility`, `owner` and `access` are per-caller and change only through the visibility endpoint.
 * - `languages[].alias` belongs to the workspace language, not the survey. The patch path strips it and
 *   refuses a change; here it is simply not part of the document, so sending it is a 422.
 *
 * The root is strict and shallow on purpose. Everything beneath a key (blocks, elements, logic, i18n maps,
 * distribution, targeting) is judged by the patch pipeline a push runs through, which is the single
 * source of those rules; a second copy here would be one more thing to drift.
 */
export const ZV3SurveyDocument = z
  .object({
    name: z.string().trim().min(1, "Survey name is required"),
    metadata: z.record(z.string(), z.unknown()).optional(),
    languages: z.array(z.unknown()).optional(),
    showLanguageSwitch: z.boolean().nullable().optional(),
    autoSelectLanguage: z.boolean().nullable().optional(),
    welcomeCard: z.record(z.string(), z.unknown()).optional(),
    blocks: z.array(z.unknown()).min(1, "At least one block is required"),
    endings: z.array(z.unknown()).optional(),
    hiddenFields: z.record(z.string(), z.unknown()).optional(),
    variables: z.array(z.unknown()).optional(),
    distribution: z.record(z.string(), z.unknown()).optional(),
    targeting: z.record(z.string(), z.unknown()).optional(),
    customCss: ZV3SurveyCustomCss.optional(),
  })
  .strict();

export type TV3SurveyDocumentRoot = z.infer<typeof ZV3SurveyDocument>;

/** Keys a push must send: they have no empty value to reset to. */
const REQUIRED_KEYS = ["name", "blocks"] as const;

const ALLOWED_KEYS = Object.keys(ZV3SurveyDocument.shape);

/** Keys that exist on the survey resource but are not part of its document, with the reason for each. */
const NOT_A_DOCUMENT_KEY_REASONS: Record<string, string> = {
  id: "the survey is named by the envelope, not the document",
  workspaceId: "a survey cannot be moved to another workspace",
  createdAt: "it is server-owned",
  updatedAt: "it is the envelope's `updatedAt`, sent as `expectedUpdatedAt`",
  status: "a push never publishes, pauses or closes a survey; use the lifecycle tools",
  archivedAt: "use the archive and restore tools",
  type: "it is fixed at creation",
  defaultLanguage: "it is fixed at creation and is the `languages[]` entry with `default: true`",
  visibility: "use the survey visibility tool",
  owner: "use the survey visibility tool",
  access: "it depends on who is asking",
};

export type TV3SurveyDocumentParse =
  | { ok: true; document: TV3SurveyDocumentRoot }
  | { ok: false; invalidParams: InvalidParam[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The document root, or the `invalid_params` naming every key that is wrong: one per unknown key, one per
 * missing required key. Both are reported together so an agent fixes its document in one round.
 */
export function parseV3SurveyDocument(input: unknown): TV3SurveyDocumentParse {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      invalidParams: [{ name: "document", reason: "The document must be a JSON object" }],
    };
  }

  const invalidParams: InvalidParam[] = [];

  for (const key of Object.keys(input)) {
    if (ALLOWED_KEYS.includes(key)) continue;
    const why = NOT_A_DOCUMENT_KEY_REASONS[key];
    invalidParams.push({
      name: key,
      reason: `Unsupported field '${key}'${why ? `: ${why}` : ""}. Allowed fields: ${[...ALLOWED_KEYS].sort().join(", ")}`,
      code: "unsupported_field",
    });
  }

  for (const key of REQUIRED_KEYS) {
    if (input[key] === undefined) {
      invalidParams.push({
        name: key,
        reason: `Missing required field '${key}': a push replaces the whole document, so it cannot be left out`,
        code: "missing_required_field",
      });
    }
  }

  if (invalidParams.length > 0) {
    return { ok: false, invalidParams };
  }

  const parsed = ZV3SurveyDocument.safeParse(input);
  if (!parsed.success) {
    return { ok: false, invalidParams: formatV3ZodInvalidParams(parsed.error, "document") };
  }

  return { ok: true, document: parsed.data };
}

/**
 * The patch a document means: EVERY editable key, so a key the document leaves out is reset to what a
 * newly created survey has (no languages, no endings, no welcome card, no custom CSS, default
 * distribution and no targeting) instead of keeping what is stored. Replace, not merge.
 *
 * `distribution` and `targeting` are filled only for an app survey. A link survey that sends either one
 * keeps it in the patch, so the patch pipeline refuses it as it refuses it everywhere else.
 */
export function toV3SurveyPatchInput(
  document: TV3SurveyDocumentRoot,
  surveyType: TSurveyType
): Record<string, unknown> {
  const isApp = surveyType === "app";

  return {
    name: document.name,
    metadata: document.metadata ?? {},
    languages: document.languages ?? [],
    showLanguageSwitch: document.showLanguageSwitch ?? null,
    autoSelectLanguage: document.autoSelectLanguage ?? null,
    welcomeCard: document.welcomeCard ?? { enabled: false },
    blocks: document.blocks,
    endings: document.endings ?? [],
    hiddenFields: document.hiddenFields ?? { enabled: false },
    variables: document.variables ?? [],
    ...(isApp
      ? {
          distribution: document.distribution ?? {},
          targeting: document.targeting ?? { filters: [] },
        }
      : {
          ...(document.distribution === undefined ? {} : { distribution: document.distribution }),
          ...(document.targeting === undefined ? {} : { targeting: document.targeting }),
        }),
    customCss: document.customCss ?? null,
  };
}

/**
 * A survey as its document: the GET representation without the lifecycle, identity and per-caller fields,
 * and without the workspace-owned language alias. What `pull` answers and what a push is compared with.
 */
export function toV3SurveyDocument(
  resource: ReturnType<typeof serializeV3SurveyResource>
): Record<string, unknown> {
  return {
    name: resource.name,
    metadata: resource.metadata,
    languages: resource.languages.map(({ code, default: isDefault, enabled }) => ({
      code,
      default: isDefault,
      enabled,
    })),
    showLanguageSwitch: resource.showLanguageSwitch,
    autoSelectLanguage: resource.autoSelectLanguage,
    welcomeCard: resource.welcomeCard,
    blocks: resource.blocks,
    endings: resource.endings,
    hiddenFields: resource.hiddenFields,
    variables: resource.variables,
    ...("distribution" in resource ? { distribution: resource.distribution } : {}),
    ...("targeting" in resource ? { targeting: resource.targeting } : {}),
    customCss: resource.customCss,
  };
}

/** The document with object keys in a fixed order, so two equal documents compare equal as JSON. */
export function canonicalizeV3SurveyDocument(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeV3SurveyDocument);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeV3SurveyDocument(value[key])])
    );
  }
  return value;
}
