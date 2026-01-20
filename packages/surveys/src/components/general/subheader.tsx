import DOMPurify from "isomorphic-dompurify";
import { isValidHTML, stripInlineStyles } from "@/lib/html-utils";

interface SubheaderProps {
  subheader?: string;
  elementId: string;
}

export function Subheader({ subheader, elementId }: SubheaderProps) {
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

  return (
    <label
      htmlFor={elementId}
      className="text-subheading block text-sm leading-6 font-normal wrap-break-word"
      data-testid="subheader"
      dir="auto">
      {isHtml ? (
        <span className="htmlbody" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <span>{subheader}</span>
      )}
    </label>
  );
}
