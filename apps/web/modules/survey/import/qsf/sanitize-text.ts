import DOMPurify from "isomorphic-dompurify";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { FOLLOW_UP_BODY_SANITIZE_CONFIG } from "@/modules/survey/follow-ups/lib/sanitize-follow-up-body";
import type { TQsfImportIssue, TQsfImportIssueCode } from "../types";
import { QSF_MAX_TEXT_CHARS, QSF_MAX_TEXT_TAGS } from "./limits";
import type { TQsfSurvey, TQsfTextFormat, TQsfTextKey } from "./qsf-model";

/**
 * Text sanitizing for the Qualtrics import (ENG-3607).
 *
 * - Headlines and the ending message keep rich text, through the follow-up email allowlist
 *   (`FOLLOW_UP_BODY_SANITIZE_CONFIG`, unchanged). Accepted trade-offs: https links survive, `class`
 *   survives, underline is dropped, and `<div>` lines run together.
 * - Every other text becomes plain text, then is parsed once more: `textContent` decodes
 *   `&lt;img onerror…&gt;` into markup, and survey-ui's `Label` renders any string that parses as
 *   HTML as HTML. A text that parses into elements gets its `<` replaced, so it shows as typed.
 *
 * DOMPurify is the parser throughout; nothing is stripped with a regex. What it removed is read from
 * the default export's `DOMPurify.removed` right after each call — the named `removed` export is a
 * Proxy that breaks array methods.
 *
 * `FORCE_BODY` is set on every call: without it the HTML parser moves a leading `<script>` or
 * `<style>` into the head, where DOMPurify neither sees nor reports it. It changes parsing, not the
 * allowlist.
 */

const RICH_CONFIG = {
  ...FOLLOW_UP_BODY_SANITIZE_CONFIG,
  FORCE_BODY: true,
  RETURN_DOM_FRAGMENT: true as const,
};
const PLAIN_CONFIG = { ALLOWED_TAGS: [] as string[], FORCE_BODY: true, RETURN_DOM_FRAGMENT: true as const };

/** Stands in for `<` in plain text that would otherwise parse as markup. */
const NEUTRAL_LESS_THAN = "\uFF1C";

/** How long a run of sanitizing may hold the event loop before it yields. */
const SANITIZE_SLICE_MS = 10;

/** Removed elements that say nothing about the text: the parser's wrappers and plain structure. */
const STRUCTURAL_TAGS = new Set(["body", "html", "head", "remove", "div", "p", "br", "span"]);
const MEDIA_TAGS = new Set([
  "img",
  "image",
  "picture",
  "svg",
  "video",
  "audio",
  "source",
  "track",
  "canvas",
  "map",
  "area",
]);
const ACTIVE_TAGS = new Set([
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "noscript",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "template",
  "math",
]);
const STYLE_ATTRIBUTES = new Set(["style", "color", "bgcolor", "face", "size", "align", "class"]);
const ACTIVE_URL = /^\s*(?:javascript|vbscript|data):/i;

type TDroppedCode = Extract<TQsfImportIssueCode, "image_dropped" | "script_dropped" | "formatting_dropped">;

interface TSanitizedText {
  text: string;
  /** The text without markup, for the prompt. Equal to `text` for plain text. */
  plain: string;
  dropped: Set<TDroppedCode>;
  escaped: boolean;
  tooLong: boolean;
}

const elementName = (node: unknown): string =>
  typeof node === "object" && node !== null && "nodeName" in node && typeof node.nodeName === "string"
    ? node.nodeName.toLowerCase()
    : "";

const hasStyleAttribute = (node: unknown): boolean =>
  typeof node === "object" &&
  node !== null &&
  "hasAttribute" in node &&
  typeof node.hasAttribute === "function" &&
  Boolean(node.hasAttribute("style"));

/** What the last DOMPurify call removed, as report codes. */
function readDropped(into: Set<TDroppedCode>): void {
  for (const entry of DOMPurify.removed) {
    if ("element" in entry) {
      const tag = elementName(entry.element);
      if (MEDIA_TAGS.has(tag)) into.add("image_dropped");
      else if (ACTIVE_TAGS.has(tag)) into.add("script_dropped");
      else if (tag === "style" || hasStyleAttribute(entry.element)) into.add("formatting_dropped");
      else if (tag !== "" && !STRUCTURAL_TAGS.has(tag)) into.add("formatting_dropped");
      continue;
    }

    const attribute = entry.attribute;
    if (!attribute) continue;
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on") || (name === "href" && ACTIVE_URL.test(attribute.value))) {
      into.add("script_dropped");
    } else if (STYLE_ATTRIBUTES.has(name)) {
      into.add("formatting_dropped");
    }
  }
}

const collapseWhitespace = (text: string): string => text.replaceAll(/\s+/g, " ").trim();

const countTags = (text: string): number => {
  let count = 0;
  for (let index = text.indexOf("<"); index !== -1; index = text.indexOf("<", index + 1)) count += 1;
  return count;
};

/**
 * Whether plain text parses into HTML elements. `textContent` decodes entities, so `&lt;b&gt;` in the
 * file is `<b>` here — markup again, one parse later.
 */
export function containsMarkup(text: string): boolean {
  if (!text.includes("<")) return false;
  DOMPurify.sanitize(text, PLAIN_CONFIG);
  return DOMPurify.removed.some(
    (entry) => "element" in entry && !["body", "html", "head", "remove"].includes(elementName(entry.element))
  );
}

/** Plain text that renders as typed: `<` replaced where the text would parse as markup. */
function neutralize(text: string): { text: string; escaped: boolean } {
  return containsMarkup(text)
    ? { text: text.replaceAll("<", NEUTRAL_LESS_THAN), escaped: true }
    : { text, escaped: false };
}

function sanitizePlain(raw: string, dropped: Set<TDroppedCode>): { text: string; escaped: boolean } {
  if (!raw.includes("<") && !raw.includes("&")) return { text: collapseWhitespace(raw), escaped: false };

  const fragment = DOMPurify.sanitize(raw, PLAIN_CONFIG);
  readDropped(dropped);
  return neutralize(collapseWhitespace(fragment.textContent ?? ""));
}

function sanitizeRich(
  raw: string,
  dropped: Set<TDroppedCode>
): { text: string; plain: string; escaped: boolean } {
  if (!raw.includes("<") && !raw.includes("&")) {
    const text = collapseWhitespace(raw);
    return { text, plain: text, escaped: false };
  }

  const fragment = DOMPurify.sanitize(raw, RICH_CONFIG);
  readDropped(dropped);
  const plain = collapseWhitespace(fragment.textContent ?? "");

  if (fragment.querySelector("*") === null) {
    // No markup left. Stored as the decoded text: kept as HTML, `&amp;` would show literally, because
    // `Label` only renders a string as HTML when it parses into elements.
    const neutral = neutralize(plain);
    return { text: neutral.text, plain: neutral.text, escaped: neutral.escaped };
  }

  const holder = fragment.ownerDocument.createElement("div");
  holder.append(fragment);
  return { text: holder.innerHTML.trim(), plain, escaped: false };
}

/** Sanitize one text. Synchronous; callers that sanitize many texts yield between them. */
export function sanitizeText(raw: string, format: TQsfTextFormat): TSanitizedText {
  const dropped = new Set<TDroppedCode>();
  if (raw.length > QSF_MAX_TEXT_CHARS || countTags(raw) > QSF_MAX_TEXT_TAGS) {
    return { text: "", plain: "", dropped, escaped: false, tooLong: true };
  }

  if (format === "rich") {
    const result = sanitizeRich(raw, dropped);
    return { ...result, dropped, tooLong: false };
  }

  const result = sanitizePlain(raw, dropped);
  return { text: result.text, plain: result.text, dropped, escaped: result.escaped, tooLong: false };
}

export interface TSanitizedTexts {
  /** The text to store, by text key and language. */
  byKey: Map<TQsfTextKey, Map<string, string>>;
  /** The default language's text without markup, by text key, for the prompt. */
  plainDefault: Map<TQsfTextKey, string>;
  issues: TQsfImportIssue[];
}

/**
 * Sanitize every text of the survey. Yields to the event loop every `SANITIZE_SLICE_MS` (by elapsed
 * time, not by count: one long text can cost more than a hundred short ones) and stops when `signal`
 * aborts.
 */
export async function sanitizeQsfTexts(survey: TQsfSurvey, signal: AbortSignal): Promise<TSanitizedTexts> {
  const byKey = new Map<TQsfTextKey, Map<string, string>>();
  const plainDefault = new Map<TQsfTextKey, string>();
  const issues: TQsfImportIssue[] = [];
  const reported = new Set<string>();

  const report = (code: TQsfImportIssueCode, questionRef: string | null) => {
    // Formatting is one line per survey; everything else one line per question.
    const scope = code === "formatting_dropped" ? "" : (questionRef ?? "");
    const id = `${code}\u0000${scope}`;
    if (reported.has(id)) return;
    reported.add(id);
    const exportTag = questionRef === null ? undefined : survey.questions.get(questionRef)?.exportTag;
    issues.push({
      code,
      severity: code === "formatting_dropped" ? "info" : "warning",
      ...(exportTag && code !== "formatting_dropped" ? { questionTag: exportTag } : {}),
    });
  };

  let sliceStart = performance.now();
  for (const [key, entry] of survey.texts) {
    const sanitized = new Map<string, string>();
    for (const [language, raw] of entry.byLanguage) {
      if (performance.now() - sliceStart > SANITIZE_SLICE_MS) {
        await yieldToEventLoop();
        signal.throwIfAborted();
        sliceStart = performance.now();
      }

      const result = sanitizeText(raw, entry.format);
      sanitized.set(language, result.text);
      if (language === survey.defaultLanguage) plainDefault.set(key, result.plain);
      for (const code of result.dropped) report(code, entry.questionRef);
      if (result.escaped) report("markup_escaped", entry.questionRef);
      if (result.tooLong) report("text_too_long", entry.questionRef);
    }
    byKey.set(key, sanitized);
  }

  return { byKey, plainDefault, issues };
}

/** Plain text for a name from the file (the survey's, an export tag used as a headline). */
export function sanitizeName(raw: string): string {
  return sanitizeText(raw, "plain").text;
}
