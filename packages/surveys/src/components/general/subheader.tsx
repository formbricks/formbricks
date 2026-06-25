import DOMPurify from "isomorphic-dompurify";
import { isValidHTML, stripInlineStyles } from "@/lib/html-utils";

interface SubheaderProps {
  subheader?: string;
}

export function Subheader({ subheader }: SubheaderProps) {
  // Strip inline styles BEFORE parsing to avoid CSP violations
  const strippedSubheader = subheader ? stripInlineStyles(subheader) : "";
  const isHtml = strippedSubheader ? isValidHTML(strippedSubheader) : false;
  const safeHtml =
    isHtml && strippedSubheader
      ? DOMPurify.sanitize(strippedSubheader, {
          ADD_ATTR: ["target"],
          FORBID_ATTR: ["style"], // Additional safeguard to remove any remaining inline styles
        })
      : "";

  if (!subheader) return null;

  // Description text, not a form label: a paragraph for plain text, and a div
  // for rich text (which may contain block elements that can't nest in a <p>).
  const className = "text-subheading label-description block text-sm leading-6 font-normal wrap-break-word";

  return isHtml ? (
    <div
      className={`${className} htmlbody`}
      data-testid="subheader"
      dir="auto"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  ) : (
    <p className={className} data-testid="subheader" dir="auto">
      {subheader}
    </p>
  );
}
