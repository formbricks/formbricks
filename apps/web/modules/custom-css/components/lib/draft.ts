import {
  CUSTOM_CSS_MAX_SOURCE_BYTES,
  type TCustomCssAppearance,
  type TCustomCssCompiled,
  type TCustomCssInput,
  type TCustomCssScope,
  type TCustomCssStored,
} from "@formbricks/types/custom-css";

/**
 * What the editor's two textareas hold. Always strings, so a field is never uncontrolled; an empty
 * or whitespace-only field means "no CSS" for that appearance.
 */
export interface TCustomCssDraft {
  light: string;
  dark: string;
}

export const EMPTY_CUSTOM_CSS_DRAFT: TCustomCssDraft = { light: "", dark: "" };

/** Editor state or a value from the server, in either shape, or no CSS at all. */
export type TCustomCssDraftOrInput = TCustomCssDraft | TCustomCssInput | null | undefined;

export const CUSTOM_CSS_APPEARANCES = ["light", "dark"] as const satisfies readonly TCustomCssAppearance[];

const normalizeField = (value: string | null | undefined): string | null =>
  value == null || value.trim() === "" ? null : value;

/**
 * The same "no CSS" rule the server applies before it compares or stores anything: a field that
 * trims to empty is `null`, and both fields `null` is no CSS at all. Non-empty source is kept
 * verbatim, so what the creator typed is what gets saved.
 */
export const normalizeCustomCssInput = (input: TCustomCssDraftOrInput): TCustomCssInput | null => {
  if (!input) return null;
  const light = normalizeField(input.light);
  const dark = normalizeField(input.dark);
  return light === null && dark === null ? null : { light, dark };
};

export const toCustomCssDraft = (input: TCustomCssInput | null | undefined): TCustomCssDraft => ({
  light: input?.light ?? "",
  dark: input?.dark ?? "",
});

/** The editable source of a stored value. Compiled output never reaches an editor field. */
export const getCustomCssSource = (stored: TCustomCssStored | null | undefined): TCustomCssInput | null =>
  stored ? { light: stored.light?.source ?? null, dark: stored.dark?.source ?? null } : null;

/**
 * UTF-8 byte length without allocating an encoded copy, so the counter can run on every keystroke
 * of a 100 KB stylesheet. Matches `TextEncoder`, including a lone surrogate counting as the three
 * bytes of the U+FFFD it is encoded as.
 */
export const getUtf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    // A surrogate pair reads as one code point above U+FFFF; a lone surrogate reads as itself.
    const codePoint = value.codePointAt(index) ?? 0;
    if (codePoint < 0x80) {
      bytes += 1;
    } else if (codePoint < 0x800) {
      bytes += 2;
    } else if (codePoint < 0x10000) {
      bytes += 3;
    } else {
      bytes += 4;
      index++;
    }
  }
  return bytes;
};

/** Combined light + dark source size, the quantity the per-scope budget applies to. */
export const getCustomCssByteSize = (input: TCustomCssDraftOrInput): number => {
  const normalized = normalizeCustomCssInput(input);
  if (!normalized) return 0;
  return getUtf8ByteLength(normalized.light ?? "") + getUtf8ByteLength(normalized.dark ?? "");
};

export const getCustomCssByteLimit = (scope: TCustomCssScope): number => CUSTOM_CSS_MAX_SOURCE_BYTES[scope];

export const isOverCustomCssByteLimit = (scope: TCustomCssScope, input: TCustomCssDraftOrInput): boolean =>
  getCustomCssByteSize(input) > getCustomCssByteLimit(scope);

export const isSameCustomCss = (a: TCustomCssDraftOrInput, b: TCustomCssDraftOrInput): boolean => {
  const left = normalizeCustomCssInput(a);
  const right = normalizeCustomCssInput(b);
  return left?.light === right?.light && left?.dark === right?.dark;
};

/**
 * How a draft differs from what is saved, in the terms the plan gate uses (ENG-2949): clearing a
 * field is allowed without Scale, any addition or edit is not. A draft that both clears one field
 * and edits the other is an edit.
 */
export type TCustomCssChangeKind = "unchanged" | "removal" | "edit";

export const getCustomCssChangeKind = (
  saved: TCustomCssDraftOrInput,
  draft: TCustomCssDraftOrInput
): TCustomCssChangeKind => {
  const before = normalizeCustomCssInput(saved);
  const after = normalizeCustomCssInput(draft);
  let hasRemoval = false;

  for (const appearance of CUSTOM_CSS_APPEARANCES) {
    const previous = before?.[appearance] ?? null;
    const next = after?.[appearance] ?? null;
    if (previous === next) continue;
    if (next !== null) return "edit";
    hasRemoval = true;
  }

  return hasRemoval ? "removal" : "unchanged";
};

/**
 * Writes a draft into the survey's stored shape so the existing survey save flow carries it. The
 * server re-processes every changed field from source and never trusts compiled output from a
 * client, so a changed field goes out with an empty `compiled`. A field whose source still matches
 * the saved one keeps its saved entry verbatim, which keeps the editor's dirty check quiet when a
 * creator types and then undoes.
 */
export const applyCustomCssDraftToStored = (
  saved: TCustomCssStored | null | undefined,
  draft: TCustomCssDraft
): TCustomCssStored | null => {
  const toEntry = (appearance: TCustomCssAppearance) => {
    const source = draft[appearance];
    if (source === "") return null;
    const savedEntry = saved?.[appearance];
    return savedEntry?.source === source ? savedEntry : { source, compiled: "" };
  };

  const light = toEntry("light");
  const dark = toEntry("dark");
  if (light === null && dark === null) return null;
  if (light === saved?.light && dark === saved?.dark) return saved;
  return { light, dark, processorVersion: saved?.processorVersion ?? 0 };
};

/**
 * A stored value reduced to what the creator controls: normalized source. Compiled output and the
 * processor version are the server's, and a field that trims to empty is no CSS, so two values that
 * differ only there describe the same saved state.
 */
export const toComparableStoredCustomCss = (
  stored: TCustomCssStored | null | undefined
): TCustomCssStored | null => {
  const normalized = normalizeCustomCssInput(getCustomCssSource(stored));
  if (!normalized) return null;
  const toEntry = (source: string | null) => (source === null ? null : { source, compiled: "" });
  return { light: toEntry(normalized.light), dark: toEntry(normalized.dark), processorVersion: 0 };
};

/**
 * Bytes of the compiled output, base and dark together, which has its own limit: scoping and
 * `!important` make it larger than the source, so a source under its limit can still be rejected (the
 * source counter alone would not show it). Counted the way the processor checks it.
 */
export const getCompiledByteSize = (compiled: TCustomCssCompiled | null | undefined): number =>
  getUtf8ByteLength(compiled?.light ?? "") + getUtf8ByteLength(compiled?.dark ?? "");
