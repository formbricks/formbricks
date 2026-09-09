import { importInfo } from "../../report";
import type { TImportIssue } from "../../types";
import { mapEmbeddedDataFieldName } from "./embedded-data";

export type TPipedTextContext = {
  /** Qualtrics `QID` → Formbricks element id. */
  qidToElementId: ReadonlyMap<string, string>;
  /** Hidden field ids the document declares (normalized). */
  hiddenFieldIds: ReadonlySet<string>;
};

const PIPE_PATTERN = /\$\{([a-zA-Z]+):\/\/([^}]*)\}/g;

/**
 * Qualtrics piped text → Formbricks recall. `${q://QID3/...}` becomes a recall of the element QID3
 * mapped to; `${e://Field/name}` a recall of the hidden field the embedded-data field became; every
 * other pipe (`lm://`, `rand://`, `date://`, `loc://`) has no equivalent and is removed.
 */
export function replacePipedText(text: string, ctx: TPipedTextContext): { text: string; stripped: string[] } {
  const stripped: string[] = [];

  const replaced = text.replaceAll(PIPE_PATTERN, (token: string, scheme: string, rest: string) => {
    if (scheme === "q") {
      const qid = rest.split("/")[0];
      const elementId = ctx.qidToElementId.get(qid);
      if (elementId) return `#recall:${elementId}/fallback:#`;
    } else if (scheme === "e") {
      const segments = rest.split("/");
      if (segments[0] === "Field" && segments[1]) {
        const fieldId = mapEmbeddedDataFieldName(segments[1]).fieldId;
        if (ctx.hiddenFieldIds.has(fieldId)) return `#recall:${fieldId}/fallback:#`;
      }
    }
    stripped.push(token);
    return "";
  });

  return { text: replaced.replaceAll(/\s{2,}/g, " ").trim(), stripped };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A translatable map in the public shape: every value a string. */
function isI18nMap(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

const TEXT_KEYS = new Set([
  "headline",
  "subheader",
  "placeholder",
  "label",
  "buttonLabel",
  "backButtonLabel",
  "ctaButtonLabel",
  "lowerLabel",
  "upperLabel",
  "otherOptionPlaceholder",
  "title",
  "description",
]);

function walk(value: unknown, path: string, ctx: TPipedTextContext, stripped: Map<string, string>): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}.${index}`, ctx, stripped));
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = path ? `${path}.${key}` : key;
    if (TEXT_KEYS.has(key) && isI18nMap(entry)) {
      for (const [code, text] of Object.entries(entry)) {
        if (!text.includes("${")) continue;
        const result = replacePipedText(text, ctx);
        entry[code] = result.text;
        for (const token of result.stripped) {
          if (!stripped.has(token)) stripped.set(token, entryPath);
        }
      }
      continue;
    }
    walk(entry, entryPath, ctx, stripped);
  }
}

/**
 * Apply piped-text replacement to every translatable text of the document, in place. One
 * `pipe_stripped` note per distinct removed token, pointing at the first place it was seen.
 */
export function applyPipedTextToDocument(
  document: Record<string, unknown>,
  ctx: TPipedTextContext
): TImportIssue[] {
  const stripped = new Map<string, string>();
  walk(document, "", ctx, stripped);

  return Array.from(stripped.entries()).map(([token, path]) =>
    importInfo({ code: "pipe_stripped", path, vars: { token } })
  );
}
