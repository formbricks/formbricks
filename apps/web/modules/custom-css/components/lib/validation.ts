import { z } from "zod";
import {
  type TCustomCssCompiled,
  type TCustomCssError,
  type TCustomCssInput,
  type TCustomCssScope,
  type TCustomCssWarning,
  ZCustomCssError,
  ZCustomCssWarning,
} from "@formbricks/types/custom-css";

/** About one keystroke pause; the processor itself takes a few milliseconds even at the 100 KB limit. */
export const CUSTOM_CSS_VALIDATION_DEBOUNCE_MS = 300;

/** Compiled output of one scope as the validate route returns it: `null` for an empty field. */
export interface TCustomCssCompiledPair {
  light: string | null;
  dark: string | null;
}

export type TCustomCssValidationResult =
  | { valid: true; compiled: TCustomCssCompiledPair; warnings: TCustomCssWarning[] }
  | { valid: false; errors: TCustomCssError[] };

/**
 * Lenient on extra keys (the route's envelope grows additively), strict on what reaches the preview:
 * only a response that says `valid: true` and carries string-or-null compiled fields is usable.
 */
const ZValidResponse = z.object({
  valid: z.literal(true),
  customCss: z.object({ light: z.string().nullable(), dark: z.string().nullable() }),
  warnings: z.array(ZCustomCssWarning).optional(),
});

const ZInvalidResponse = z.object({
  valid: z.literal(false),
  errors: z.array(ZCustomCssError).optional(),
  invalid_params: z.array(z.object({ name: z.string(), reason: z.string() })).optional(),
});

const processingFailed = (scope: TCustomCssScope, reason: string): TCustomCssError => ({
  code: "processing_failed",
  scope,
  appearance: null,
  line: null,
  column: null,
  reason,
});

/**
 * Turns the validate route's `data` into a result the editor can act on. Anything it cannot read as a
 * valid result is an invalid one, so a surprising response can never put CSS in the preview or let a
 * save through on its say-so.
 */
export const parseCustomCssValidationData = (
  data: unknown,
  scope: TCustomCssScope
): TCustomCssValidationResult => {
  const valid = ZValidResponse.safeParse(data);
  if (valid.success) {
    return { valid: true, compiled: valid.data.customCss, warnings: valid.data.warnings ?? [] };
  }

  const invalid = ZInvalidResponse.safeParse(data);
  if (invalid.success) {
    const errors = invalid.data.errors ?? [];
    if (errors.length > 0) return { valid: false, errors };
    const params = invalid.data.invalid_params ?? [];
    return {
      valid: false,
      errors:
        params.length > 0
          ? params.map((param) => processingFailed(scope, param.reason))
          : [processingFailed(scope, "The CSS could not be validated.")],
    };
  }

  return { valid: false, errors: [processingFailed(scope, "Unexpected validation response.")] };
};

/** The renderer's shape for one scope: absent keys for empty fields, `null` when there is no CSS. */
export const toRendererCompiled = (
  compiled: TCustomCssCompiledPair | null | undefined
): TCustomCssCompiled | null => {
  if (!compiled) return null;
  const result: TCustomCssCompiled = {};
  if (compiled.light) result.light = compiled.light;
  if (compiled.dark) result.dark = compiled.dark;
  return result.light || result.dark ? result : null;
};

/**
 * The local budget check's own error, so an oversized draft is reported without a request. The
 * editor words it from the byte counts; `reason` stays empty because nothing here is from the server.
 */
export const getSourceTooLargeError = (scope: TCustomCssScope): TCustomCssError => ({
  code: "source_too_large",
  scope,
  appearance: null,
  line: null,
  column: null,
  reason: "",
});

/** Typed query-key factory. Never inline string keys — mutations update these exact tuples. */
const customCssKeyBase = ["custom-css"] as const;

export const customCssKeys = {
  all: customCssKeyBase,
  workspace: (workspaceId: string) => [...customCssKeyBase, "workspace", workspaceId] as const,
  /**
   * Keyed by the draft content itself, which is what makes out-of-order responses harmless: a
   * response can only ever be read back under the content it was computed for, so a slow answer to
   * an older draft lands in its own cache entry and never replaces the current one.
   */
  validation: (params: {
    workspaceId: string;
    scope: TCustomCssScope;
    surveyId?: string | null;
    input: TCustomCssInput;
  }) =>
    [
      ...customCssKeyBase,
      "validation",
      params.workspaceId,
      params.scope,
      params.surveyId ?? null,
      params.input.light,
      params.input.dark,
    ] as const,
};

/** Identity of a draft's content, for comparing "the draft on screen" with "the draft last checked". */
export const getCustomCssDraftKey = (input: TCustomCssInput | null): string =>
  input === null ? "" : JSON.stringify([input.light, input.dark]);

/**
 * The inverse of `getCustomCssDraftKey`. The debounce runs on the key — a string, so re-renders that
 * rebuild an equal draft object do not restart the timer — and the checked content is read back from
 * it, which guarantees a request is always for exactly the content its key names.
 */
export const parseCustomCssDraftKey = (key: string): TCustomCssInput | null => {
  if (key === "") return null;
  const [light, dark] = JSON.parse(key) as [string | null, string | null];
  return { light, dark };
};

export type TCustomCssValidationStatus = "empty" | "pending" | "valid" | "invalid" | "unavailable";

/** The newest draft known to be valid, with its compiled output — what the preview keeps showing. */
export interface TCustomCssLastValid {
  key: string;
  compiled: TCustomCssCompiled | null;
}

export interface TCustomCssValidationState {
  status: TCustomCssValidationStatus;
  /** What the preview applies: the current draft's compiled CSS, or the last valid draft's. */
  previewCss: TCustomCssCompiled | null;
  /** The preview is showing an earlier draft because the current one is pending, invalid or unchecked. */
  isPreviewBehind: boolean;
  warnings: TCustomCssWarning[];
  errors: TCustomCssError[];
}

/** Where the current draft's own check stands. `settled` is only ever a result for the current draft. */
export type TCustomCssDraftCheck =
  | { kind: "empty" }
  | { kind: "pending" }
  | { kind: "local-error"; errors: TCustomCssError[] }
  | { kind: "request-failed" }
  | { kind: "settled"; result: TCustomCssValidationResult };

/**
 * The editor's validation state from the current draft's check and the last valid draft. Only the
 * current draft's own result can make the preview current; anything else keeps the last valid CSS on
 * screen and says so, so an invalid or unchecked draft never reaches the DOM.
 */
export const deriveCustomCssValidationState = (
  check: TCustomCssDraftCheck,
  lastValid: TCustomCssLastValid | null,
  currentKey: string
): TCustomCssValidationState => {
  const behind = (status: TCustomCssValidationStatus, errors: TCustomCssError[] = []) => ({
    status,
    previewCss: lastValid?.compiled ?? null,
    isPreviewBehind: lastValid !== null && lastValid.key !== currentKey,
    warnings: [],
    errors,
  });

  switch (check.kind) {
    case "empty":
      return { status: "empty", previewCss: null, isPreviewBehind: false, warnings: [], errors: [] };
    case "pending":
      return behind("pending");
    case "local-error":
      return behind("invalid", check.errors);
    case "request-failed":
      return behind("unavailable");
    case "settled":
      if (check.result.valid) {
        return {
          status: "valid",
          // The stored object when it is this draft's, so the preview prop keeps its identity
          // across re-renders and a memoized preview does not re-mount the survey for nothing.
          previewCss:
            lastValid?.key === currentKey ? lastValid.compiled : toRendererCompiled(check.result.compiled),
          isPreviewBehind: false,
          warnings: check.result.warnings,
          errors: [],
        };
      }
      return behind("invalid", check.result.errors);
  }
};

/**
 * The next "last valid" value. Moves forward only on a valid result for the draft currently on
 * screen (an empty draft counts: it previews as no CSS), so neither an invalid draft nor a stale
 * response can ever replace it.
 */
export const getNextLastValid = (
  previous: TCustomCssLastValid | null,
  check: TCustomCssDraftCheck,
  currentKey: string
): TCustomCssLastValid | null => {
  if (previous?.key === currentKey) return previous;
  if (check.kind === "empty") return { key: currentKey, compiled: null };
  if (check.kind === "settled" && check.result.valid) {
    return { key: currentKey, compiled: toRendererCompiled(check.result.compiled) };
  }
  return previous;
};

/** Whether a draft in this state may be saved. The server validates again either way. */
export const canSaveCustomCssDraft = (status: TCustomCssValidationStatus): boolean =>
  status === "valid" || status === "empty" || status === "unavailable";
