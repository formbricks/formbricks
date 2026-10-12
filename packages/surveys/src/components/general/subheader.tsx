import { FB_PART } from "@formbricks/survey-ui/parts";
import { isValidHTML, sanitizeSurveyHtml, stripInlineStyles } from "@/lib/html-utils";

interface SubheaderProps {
  subheader?: string;
}

export function Subheader({ subheader }: SubheaderProps) {
  // Strip inline styles BEFORE parsing to avoid CSP violations
  const strippedSubheader = subheader ? stripInlineStyles(subheader) : "";
  const isHtml = strippedSubheader ? isValidHTML(strippedSubheader) : false;
  const safeHtml = isHtml && strippedSubheader ? sanitizeSurveyHtml(strippedSubheader) : "";

  if (!subheader) return null;

  // Description text, not a form label: a paragraph for plain text, and a div
  // for rich text (which may contain block elements that can't nest in a <p>).
  const className = "label-description block leading-6 wrap-break-word";

  // Rich text has no color, size or weight utility (`text-subheading`, `text-sm`, `font-normal`): those
  // are `!important` inside a cascade layer, and its formatted children inherit from this element, so
  // they would override the description values the children have always shown.
  // `.htmlbody.label-description` sets those values instead.
  return isHtml ? (
    <div
      className={`${className} htmlbody`}
      data-fb-part={FB_PART.description}
      data-testid="subheader"
      dir="auto"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  ) : (
    <p
      className={`text-subheading ${className} text-sm font-normal`}
      data-fb-part={FB_PART.description}
      data-testid="subheader"
      dir="auto">
      {subheader}
    </p>
  );
}
