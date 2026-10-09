import DOMPurify from "isomorphic-dompurify";
import { FOLLOW_UP_BODY_SANITIZE_CONFIG } from "@/modules/survey/follow-ups/lib/sanitize-follow-up-body";
import type { TQsfImportIssueCode } from "../types";
import { createSlicer } from "./event-loop";
import { QSF_MAX_TEXT_CHARS, QSF_MAX_TEXT_TAGS } from "./limits";
import { hasMarkup } from "./markup";
import type { TQsfIssue, TQsfSurvey, TQsfTextFormat, TQsfTextKey } from "./qsf-model";

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

/** The report code for an element DOMPurify removed, or `null` for structure (`body`, `div`, …). */
function droppedElementCode(element: unknown): TDroppedCode | null {
  const tag = elementName(element);
  if (MEDIA_TAGS.has(tag)) return "image_dropped";
  if (ACTIVE_TAGS.has(tag)) return "script_dropped";
  if (tag === "style" || hasStyleAttribute(element)) return "formatting_dropped";
  return tag !== "" && !STRUCTURAL_TAGS.has(tag) ? "formatting_dropped" : null;
}

/** The report code for an attribute DOMPurify removed, or `null` for one not worth a line. */
function droppedAttributeCode(attribute: { name: string; value: string }): TDroppedCode | null {
  const name = attribute.name.toLowerCase();
  if (name.startsWith("on") || (name === "href" && ACTIVE_URL.test(attribute.value))) return "script_dropped";
  return STYLE_ATTRIBUTES.has(name) ? "formatting_dropped" : null;
}

/** What the last DOMPurify call removed, as report codes. */
function readDropped(into: Set<TDroppedCode>): void {
  for (const entry of DOMPurify.removed) {
    let code: TDroppedCode | null = null;
    if ("element" in entry) code = droppedElementCode(entry.element);
    else if (entry.attribute) code = droppedAttributeCode(entry.attribute);
    if (code) into.add(code);
  }
}

const collapseWhitespace = (text: string): string => text.replaceAll(/\s+/g, " ").trim();

/** The `<` in a text, counted up to just past `limit`. */
const countLessThan = (text: string, limit: number): number => {
  let count = 0;
  for (let index = text.indexOf("<"); index !== -1 && count <= limit; index = text.indexOf("<", index + 1)) {
    count += 1;
  }
  return count;
};

/**
 * A `<` written as a character reference: `&lt;`, `&#60;`, `&#x3c;`, with or without the semicolon, any
 * case and any zero padding (`&nvlt;` decodes to `<` too). `textContent` decodes each into a `<` that the
 * next parse reads as a tag. Counting a few that are not `<` (`&LT;` is) only errs towards the cap.
 */
const ENCODED_LESS_THAN = /&(?:nv)?lt|&#0*60(?!\d)|&#x0*3c(?![\da-f])/gi;

/**
 * The tags a text can open in any parse: its own `<`, plus every `<` it holds as a character reference,
 * which decoding turns into tags one parse later. Counted up to just past `limit`.
 */
const countTags = (text: string, limit: number): number => {
  let count = countLessThan(text, limit);
  if (count > limit || !text.includes("&")) return count;
  for (const _match of text.matchAll(ENCODED_LESS_THAN)) {
    count += 1;
    if (count > limit) break;
  }
  return count;
};

/**
 * Whether plain text parses into HTML elements. `textContent` decodes entities, so `&lt;b&gt;` in the
 * file is `<b>` here — markup again, one parse later.
 *
 * A text with more `<` than a text may hold tags is markup without being parsed: a parse costs about
 * linear time in its tags, and thousands of nested ones (`&lt;i>` repeated, decoded) block the event
 * loop for seconds before DOMPurify throws a `RangeError`. `sanitizeText` refuses such a text first by
 * counting its encoded `<`; this holds for any text that reaches here by another decode.
 */
export function containsMarkup(text: string): boolean {
  if (!text.includes("<")) return false;
  if (countLessThan(text, QSF_MAX_TEXT_TAGS) > QSF_MAX_TEXT_TAGS) return true;
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
  if (!hasMarkup(raw)) return { text: collapseWhitespace(raw), escaped: false };

  const fragment = DOMPurify.sanitize(raw, PLAIN_CONFIG);
  readDropped(dropped);
  return neutralize(collapseWhitespace(fragment.textContent ?? ""));
}

function sanitizeRich(
  raw: string,
  dropped: Set<TDroppedCode>
): { text: string; plain: string; escaped: boolean } {
  if (!hasMarkup(raw)) {
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
  if (raw.length > QSF_MAX_TEXT_CHARS || countTags(raw, QSF_MAX_TEXT_TAGS) > QSF_MAX_TEXT_TAGS) {
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
  issues: TQsfIssue[];
}

/**
 * The report lines sanitizing writes: formatting once per survey, everything else once per question
 * and code.
 */
class SanitizeReporter {
  readonly issues: TQsfIssue[] = [];
  private readonly reported = new Set<string>();

  constructor(private readonly survey: TQsfSurvey) {}

  add(result: TSanitizedText, questionRef: string | null): void {
    for (const code of result.dropped) this.report(code, questionRef);
    if (result.escaped) this.report("markup_escaped", questionRef);
    if (result.tooLong) this.report("text_too_long", questionRef);
  }

  private report(code: TQsfImportIssueCode, questionRef: string | null): void {
    const perSurvey = code === "formatting_dropped";
    const id = `${code}\u0000${perSurvey ? "" : (questionRef ?? "")}`;
    if (this.reported.has(id)) return;
    this.reported.add(id);
    const exportTag = questionRef === null ? undefined : this.survey.questions.get(questionRef)?.exportTag;
    this.issues.push({
      code,
      severity: perSurvey ? "info" : "warning",
      ...(exportTag && !perSurvey ? { questionTag: exportTag } : {}),
      ...(questionRef !== null && !perSurvey ? { questionRef } : {}),
    });
  }
}

/**
 * Sanitize every text of the survey. Yields to the event loop every `QSF_SLICE_MS` (by elapsed
 * time, not by count: one long text can cost more than a hundred short ones) and stops when `signal`
 * aborts.
 */
export async function sanitizeQsfTexts(survey: TQsfSurvey, signal: AbortSignal): Promise<TSanitizedTexts> {
  const byKey = new Map<TQsfTextKey, Map<string, string>>();
  const plainDefault = new Map<TQsfTextKey, string>();
  const reporter = new SanitizeReporter(survey);

  const slice = createSlicer(signal);
  for (const [key, entry] of survey.texts) {
    const sanitized = new Map<string, string>();
    for (const [language, raw] of entry.byLanguage) {
      // Yields by elapsed time, by design: the point of the loop is to give the event loop back.
      await slice(); // NOSONAR(typescript:S9382) -- a deliberate yield every slice

      const result = sanitizeText(raw, entry.format);
      sanitized.set(language, result.text);
      if (language === survey.defaultLanguage) plainDefault.set(key, result.plain);
      reporter.add(result, entry.questionRef);
    }
    byKey.set(key, sanitized);
  }

  return { byKey, plainDefault, issues: reporter.issues };
}

/** Plain text for a name from the file (the survey's, an export tag used as a headline). */
export function sanitizeName(raw: string): string {
  return sanitizeText(raw, "plain").text;
}
