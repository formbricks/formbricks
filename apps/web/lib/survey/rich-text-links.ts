import DOMPurify from "isomorphic-dompurify";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyEnding, TSurveyWelcomeCard } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/lib/survey/utils";

/** The parts of a survey whose texts the editor stores as rich text (HTML). */
export type TRichTextSurveyContent = {
  blocks?: TSurveyBlock[] | null;
  endings?: TSurveyEnding[] | null;
  welcomeCard?: TSurveyWelcomeCard | null;
};

/** Attribute names are never entity-decoded, so a string naming neither holds no link. */
const MAY_HOLD_LINK = /href|action/i;

/**
 * The URL an attribute navigates to, if it is one. The renderer's DOMPurify keeps SVG and MathML, so a
 * link is any `href` in any namespace (`<a href>`, `<area href>`, SVG `xlink:href`, MathML `href` on
 * any element), plus a `<form action>`, which its submit button follows.
 */
const getLinkTarget = (element: Element, attribute: Attr): string | undefined => {
  const isLink =
    attribute.localName.toLowerCase() === "href" ||
    (element.localName.toLowerCase() === "form" && attribute.localName.toLowerCase() === "action");
  return isLink ? attribute.value.trim() || undefined : undefined;
};

const collectLinks = (field: TI18nString | undefined, links: Set<string>): void => {
  for (const html of Object.values(field ?? {})) {
    if (typeof html !== "string" || !MAY_HOLD_LINK.test(html)) continue;
    // Parsed rather than matched: the survey renders this text through DOMPurify, and an HTML parser
    // reads `<a/href=…>` or a `>` inside a quoted attribute as a link where a regex would not.
    const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
    for (const element of fragment.querySelectorAll("*")) {
      for (const attribute of element.attributes) {
        const target = getLinkTarget(element, attribute);
        if (target) links.add(target);
      }
    }
  }
};

/**
 * Every link target in the survey's rich text: element headlines, subheaders and html, the welcome
 * card, and ending cards, in every language. The editor offers these links only on plans that allow
 * external URLs (ENG-3891).
 */
export const getRichTextLinks = (survey: TRichTextSurveyContent): Set<string> => {
  const links = new Set<string>();
  for (const element of getElementsFromBlocks(survey.blocks ?? [])) {
    collectLinks(element.headline, links);
    collectLinks(element.subheader, links);
    if ("html" in element) collectLinks(element.html, links);
  }
  collectLinks(survey.welcomeCard?.headline, links);
  collectLinks(survey.welcomeCard?.subheader, links);
  for (const ending of survey.endings ?? []) {
    if (ending.type !== "endScreen") continue;
    collectLinks(ending.headline, links);
    collectLinks(ending.subheader, links);
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
