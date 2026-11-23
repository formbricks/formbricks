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
// Stands in for a token while the text is parsed: letters and digits only, so the parser keeps it whole
// wherever it lands (an attribute name, an attribute value, a tag name), and lower case, as the parser
// lower-cases names.
const RECALL_MARKER = "fbrecallmarker";
const RECALL_MARKERS = new RegExp(String.raw`${RECALL_MARKER}(\d+)x`, "g");

/**
 * The tokens that sit inside markup rather than in text. Once a respondent's answer or a hidden field
 * fills one, it becomes part of that markup: escaping keeps `<` and quotes out but not `href=https://…`,
 * and no check can see the answer in advance, so each one counts as a link of its own.
 *
 * Found by parsing, not by matching tags with a pattern: the renderer replaces the whole token, fallback
 * included, before it parses, so a fallback holding `>`, `<` or a quote must not hide the token from the
 * check. Each token is swapped for a marker, the text goes through the same style stripping the renderer
 * applies, and every element and attribute the parser builds is read before anything is removed.
 */
const getTokensInMarkup = (html: string): string[] => {
  const tokens: string[] = [];
  const marked = html.replaceAll(RECALL_TOKENS, (token) => `${RECALL_MARKER}${tokens.push(token) - 1}x`);
  const found = new Set<string>();
  const record = (text: string) => {
    for (const match of text.matchAll(RECALL_MARKERS)) {
      found.add(tokens[Number(match[1])]);
    }
  };
  DOMPurify.addHook("uponSanitizeElement", (node) => record(node.nodeName.toLowerCase()));
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => record(`${data.attrName} ${data.attrValue}`));
  try {
    DOMPurify.sanitize(removeStyleAttributes(marked));
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute");
    DOMPurify.removeHook("uponSanitizeElement");
  }
  return [...found];
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
  for (const token of getTokensInMarkup(html)) links.add(`recall in a tag: ${token}`);
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
