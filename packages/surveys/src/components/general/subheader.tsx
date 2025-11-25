import DOMPurify from "isomorphic-dompurify";
import { isValidHTML } from "@/lib/html-utils";

interface SubheaderProps {
  subheader?: string;
  elementId: string;
}

export function Subheader({ subheader, elementId }: SubheaderProps) {
  const isHtml = subheader ? isValidHTML(subheader) : false;
  const safeHtml = isHtml && subheader ? DOMPurify.sanitize(subheader, { ADD_ATTR: ["target"] }) : "";

  if (!subheader) return null;

  return (
    <label
      htmlFor={elementId}
      className="fb-text-subheading fb-block fb-break-words fb-text-sm fb-font-normal fb-leading-6"
      data-testid="subheader"
      dir="auto">
      {isHtml ? (
        <span className="fb-htmlbody" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <span>{subheader}</span>
      )}
    </label>
  );
}
