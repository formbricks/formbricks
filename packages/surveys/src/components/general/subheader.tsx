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
      className="text-subheading label-description wrap-break-word block text-sm font-normal leading-6"
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
