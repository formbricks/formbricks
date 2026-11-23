import DOMPurify from "isomorphic-dompurify";
import { removeStyleAttributes, sanitizeSurveyHtml, stripInlineStyles } from "@formbricks/survey-ui/sanitize";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyEnding, TSurveyVariable, TSurveyWelcomeCard } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { escapeHtml } from "@/lib/utils/escape-html";

/** The parts of a survey whose texts the editor stores as rich text (HTML). */
export type TRichTextSurveyContent = {
  blocks?: TSurveyBlock[] | null;
  endings?: TSurveyEnding[] | null;
  welcomeCard?: TSurveyWelcomeCard | null;
  /** Read for the values `#recall:` tokens resolve to. */
  variables?: TSurveyVariable[] | null;
};

/** Attribute names are never entity-decoded, so a string naming neither holds no link. */
const MAY_HOLD_LINK = /href|action/i;

/**
 * The URL an attribute navigates to, if it is one. The renderer's allow-list (ENG-7270) keeps only the
 * editor's markup, so today only `<a href>` survives it; any `href` in any namespace and a `<form action>`
 * still count, so this check keeps holding if that list ever widens.
 */
const getLinkTarget = (element: Element, attribute: Attr): string | undefined => {
  const isLink =
    attribute.localName.toLowerCase() === "href" ||
    (element.localName.toLowerCase() === "form" && attribute.localName.toLowerCase() === "action");
  return isLink ? attribute.value.trim() || undefined : undefined;
};

const collectLinksFromRendered = (html: string, links: Set<string>): void => {
  // The renderer removes style attributes from the raw string before it parses, which can join the
  // text around one into `href` (`<a hr style="x"ef=…>`), so the cheap check reads the stripped string.
  if (!MAY_HOLD_LINK.test(removeStyleAttributes(html))) return;
  // Check what respondents get, not what is stored: the same pipeline as the survey's headline and
  // subheader components. Then parse it, since `<a/href=…>` or a quoted `>` defeats a regex.
  const rendered = sanitizeSurveyHtml(stripInlineStyles(html));
  const fragment = DOMPurify.sanitize(rendered, { RETURN_DOM_FRAGMENT: true });
  for (const element of fragment.querySelectorAll("*")) {
    for (const attribute of element.attributes) {
      const target = getLinkTarget(element, attribute);
      if (target) links.add(target);
    }
  }
};

// `replaceRecallInfo` in `@formbricks/surveys` resolves these before the text is parsed: a variable's
// value, else the respondent's answer or hidden field, else the fallback (`nbsp` read as a space).
const RECALL_TOKEN = /#recall:([A-Za-z0-9_-]+)\/fallback:([^#]*)#/;
const RECALL_TOKENS = new RegExp(RECALL_TOKEN.source, "g");
// Elements whose text the parser never turns into markup and the browser does not show as survey text
// (raw text and RCDATA). A token here is not plain text either.
const RAW_TEXT_PARENTS: ReadonlySet<string> = new Set([
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
]);

/**
 * The tokens that do not sit in plain text. Once a respondent's answer or a hidden field fills one, it
 * becomes part of whatever markup surrounds it: escaping keeps `<` and quotes out, but not
 * `href=https://…` in a tag, nor a `--` that closes a comment, nor a tag name that ends a `<textarea>`.
 * No check can see the answer in advance, so each such token counts as a link of its own.
 *
 * An allow-list, not a list of dangerous places: each token is swapped for a marker, the text goes
 * through the renderer's style stripping and a parse, and a token is plain text only if its marker
 * lands in a text node of an ordinary element. A marker in a tag, an attribute, a comment, an end tag, a
 * raw-text element, or one the stripping removed, counts. That can only over-report.
 */
const getTokensOutsidePlainText = (html: string): string[] => {
  const tokens: string[] = [];
  // Stands in for a token while the text is parsed. Random per call: survey text could otherwise spell the
  // marker inside a text node and make a token that sits in a tag look like plain text (the permission
  // check would miss it). Letters and digits only, so the parser keeps it whole wherever it lands (an
  // attribute name, an attribute value, a tag name), and lower case, as the parser lower-cases names.
  const marker = `fbrecallmarker${crypto.randomUUID().replaceAll("-", "")}`;
  const markers = new RegExp(String.raw`${marker}(\d+)x`, "g");
  const marked = html.replaceAll(RECALL_TOKENS, (token) => `${marker}${tokens.push(token) - 1}x`);
  const inPlainText = new Set<number>();
  DOMPurify.addHook("uponSanitizeElement", (node) => {
    const parent = node.parentNode;
    if (node.nodeName !== "#text" || parent?.nodeType !== 1) return;
    if (RAW_TEXT_PARENTS.has(parent.nodeName.toLowerCase())) return;
    for (const match of (node.textContent ?? "").matchAll(markers)) inPlainText.add(Number(match[1]));
  });
  try {
    // RETURN_DOM_FRAGMENT: DOMPurify returns text without `<` unparsed, and then visits nothing.
    DOMPurify.sanitize(removeStyleAttributes(marked), { RETURN_DOM_FRAGMENT: true });
  } finally {
    DOMPurify.removeHook("uponSanitizeElement");
  }
  return tokens.filter((_token, index) => !inPlainText.has(index));
};

/**
 * The text as the renderer resolves it (ENG-7270): every token in one pass, with a replacer so `$&` in a
 * value is literal, and each value HTML-escaped, so a value can add text but never markup. A value is
 * never scanned for tokens again. (A plain-text template the renderer leaves unescaped is wrapped as
 * escaped text once it would parse as HTML, so escaping here finds the same links.)
 */
const resolveRecall = (html: string, resolve: (id: string, fallback: string) => string): string =>
  html.replaceAll(RECALL_TOKENS, (_token, id: string, fallback: string) =>
    escapeHtml(resolve(id, fallback.replaceAll("nbsp", " ").trim()))
  );

/** Links in text that holds `#recall:` tokens, which the survey resolves before it parses. */
const collectRecallLinks = (
  html: string,
  links: Set<string>,
  recallValues: ReadonlyMap<string, string>
): void => {
  for (const token of getTokensOutsidePlainText(html)) links.add(`recall in a tag: ${token}`);
  // What the survey shows when each token resolves to nothing, to its fallback, or to the variable's
  // value the survey defines.
  for (const resolved of new Set([
    resolveRecall(html, () => ""),
    resolveRecall(html, (_id, fallback) => fallback),
    resolveRecall(html, (id, fallback) => recallValues.get(id) || fallback),
  ])) {
    collectLinksFromRendered(resolved, links);
  }
};

const collectLinks = (
  field: TI18nString | undefined,
  links: Set<string>,
  recallValues: ReadonlyMap<string, string>
): void => {
  for (const html of Object.values(field ?? {})) {
    if (typeof html !== "string") continue;
    if (RECALL_TOKEN.test(html)) collectRecallLinks(html, links, recallValues);
    else collectLinksFromRendered(html, links);
  }
};

/**
 * Every link target in the survey's rich text: element headlines, subheaders and html, the welcome
 * card, and ending cards, in every language, as the survey shows them once `#recall:` tokens resolve.
 * The editor offers these links only on plans that allow external URLs (ENG-3891).
 */
export const getRichTextLinks = (survey: TRichTextSurveyContent): Set<string> => {
  const links = new Set<string>();
  const recallValues = new Map((survey.variables ?? []).map(({ id, value }) => [id, String(value)]));
  const collect = (field: TI18nString | undefined) => collectLinks(field, links, recallValues);
  for (const element of getElementsFromBlocks(survey.blocks ?? [])) {
    collect(element.headline);
    collect(element.subheader);
    if ("html" in element) collect(element.html);
  }
  collect(survey.welcomeCard?.headline);
  collect(survey.welcomeCard?.subheader);
  for (const ending of survey.endings ?? []) {
    if (ending.type !== "endScreen") continue;
    collect(ending.headline);
    collect(ending.subheader);
  }
  return links;
};

/**
 * Whether the survey's rich text links somewhere the previous version did not. Links the survey
 * already had are grandfathered, as the CTA and ending-link checks do, so an organization that lost
 * external URLs can still edit a survey that has them.
 */
export const addsRichTextLink = (
  survey: TRichTextSurveyContent,
  previous?: TRichTextSurveyContent | null
): boolean => {
  const links = getRichTextLinks(survey);
  if (links.size === 0) return false;
  const previousLinks = previous ? getRichTextLinks(previous) : new Set<string>();
  return [...links].some((href) => !previousLinks.has(href));
};
