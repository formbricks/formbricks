import { z } from "zod";

/**
 * Custom CSS shared contract (ENG-2950, ENG-2949, ENG-3552, ENG-3641).
 *
 * Three shapes, one per audience — never mix them:
 * - `TCustomCssInput`     what a creator or API caller writes: source only.
 * - `TCustomCssStored`    what the database holds: source + trusted compiled output + processor version.
 * - `TCustomCssCompiled`  what a respondent receives: compiled output only, never source.
 */

export const ZCustomCssScope = z.enum(["workspace", "survey"]);
export type TCustomCssScope = z.infer<typeof ZCustomCssScope>;

/** Light is base CSS that applies in both appearances; dark adds overrides on top of it. */
export const ZCustomCssAppearance = z.enum(["light", "dark"]);
export type TCustomCssAppearance = z.infer<typeof ZCustomCssAppearance>;

/** Combined light + dark source budget per scope, in UTF-8 bytes. Compiled output is bounded by the same. */
export const CUSTOM_CSS_MAX_SOURCE_BYTES: Record<TCustomCssScope, number> = {
  workspace: 100_000,
  survey: 20_000,
};

/**
 * A cheap pre-parse bound on each field so oversized payloads are rejected before any byte counting or
 * parsing. A UTF-8 character is at least one byte, so a field longer than the scope's byte budget in
 * characters can never be valid; the exact byte budget is enforced by the processor.
 */
const ZCustomCssSourceField = z.string().max(CUSTOM_CSS_MAX_SOURCE_BYTES.workspace);

/** Write input. Both keys are required; `null` or an empty/whitespace string means "no CSS" for that field. */
export const ZCustomCssInput = z
  .object({
    light: ZCustomCssSourceField.nullable(),
    dark: ZCustomCssSourceField.nullable(),
  })
  .strict();
export type TCustomCssInput = z.infer<typeof ZCustomCssInput>;

export const ZCustomCssStoredEntry = z
  .object({
    source: z.string(),
    compiled: z.string(),
  })
  .strict();
export type TCustomCssStoredEntry = z.infer<typeof ZCustomCssStoredEntry>;

/** Persisted value of `Workspace.customCss` / `Survey.customCss` (and `Workspace.customCssPrevious`). */
export const ZCustomCssStored = z
  .object({
    light: ZCustomCssStoredEntry.nullable(),
    dark: ZCustomCssStoredEntry.nullable(),
    processorVersion: z.number().int().nonnegative(),
  })
  .strict();
export type TCustomCssStored = z.infer<typeof ZCustomCssStored>;

/** Respondent-facing compiled CSS for one scope. Absent keys mean "no CSS" for that appearance. */
export const ZCustomCssCompiled = z
  .object({
    light: z.string().optional(),
    dark: z.string().optional(),
  })
  .strict();
export type TCustomCssCompiled = z.infer<typeof ZCustomCssCompiled>;

/**
 * The explicit renderer prop. The renderer applies custom CSS only from this prop — never from CSS
 * found on a raw survey or styling object — so an SDK that does not pass it gets no custom CSS at all
 * rather than half of it.
 */
export interface TRendererCustomCss {
  workspace?: TCustomCssCompiled | null;
  survey?: TCustomCssCompiled | null;
}

/** Constructs the processor removes with a warning; the remaining valid rules still apply. */
export const ZCustomCssWarningCode = z.enum([
  "import_removed",
  "font_face_removed",
  "external_resource_removed",
  "unsupported_at_rule_removed",
  "unsafe_property_removed",
  "unsafe_value_removed",
  "fixed_position_removed",
  "unsafe_selector_removed",
]);
export type TCustomCssWarningCode = z.infer<typeof ZCustomCssWarningCode>;

/** Failures that reject the whole operation. Nothing is saved and no compiled output is returned. */
export const ZCustomCssErrorCode = z.enum([
  "syntax_error",
  "source_too_large",
  "output_too_large",
  "limit_exceeded",
  "processing_failed",
]);
export type TCustomCssErrorCode = z.infer<typeof ZCustomCssErrorCode>;

const ZCustomCssIssueBase = z.object({
  scope: ZCustomCssScope,
  /** Which source field the issue is in; `null` when it concerns the scope as a whole (e.g. size). */
  appearance: ZCustomCssAppearance.nullable(),
  /** 1-based position in that field's source; `null` when it has no single location. */
  line: z.number().int().positive().nullable(),
  column: z.number().int().positive().nullable(),
  /** Human-readable, English, never echoes customer source beyond a short construct name. */
  reason: z.string(),
});

export const ZCustomCssWarning = ZCustomCssIssueBase.extend({ code: ZCustomCssWarningCode }).strict();
export type TCustomCssWarning = z.infer<typeof ZCustomCssWarning>;

export const ZCustomCssError = ZCustomCssIssueBase.extend({ code: ZCustomCssErrorCode }).strict();
export type TCustomCssError = z.infer<typeof ZCustomCssError>;

/**
 * Cascade layer order (M2.03). Customer declarations are `!important`, and for important declarations
 * the earlier layer wins, so this reads strongest-first: survey dark > survey base > workspace dark >
 * workspace base > the theme editor and built-in styles.
 */
export const CUSTOM_CSS_LAYER_ORDER = [
  "fb-survey-dark",
  "fb-survey",
  "fb-workspace-dark",
  "fb-workspace",
  "theme",
  "base",
  "components",
  "utilities",
] as const;

export const CUSTOM_CSS_LAYER_PRELUDE = `@layer ${CUSTOM_CSS_LAYER_ORDER.join(", ")};`;
