import DOMPurify from "isomorphic-dompurify";
import * as React from "react";
import { ElementMedia } from "@/components/general/element-media";
import { Label } from "@/components/general/label";
import { cn, stripInlineStyles } from "@/lib/utils";

interface ElementHeaderProps extends React.ComponentProps<"div"> {
  headline: string;
  description?: string;
  required?: boolean;
  htmlFor?: string;
  imageUrl?: string;
  videoUrl?: string;
  imageAltText?: string;
}

/**
 * Checks if a string contains valid HTML markup
 * @param str - The input string to test
 * @returns true if the string contains valid HTML elements, false otherwise
 */
const isValidHTML = (str: string): boolean => {
  if (!str) return false;

  try {
    const doc = new DOMParser().parseFromString(str, "text/html");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) return false;
    return Array.from(doc.body.childNodes).some((node) => node.nodeType === 1);
  } catch {
    return false;
  }
};

/**
 * Strips inline style attributes to prevent CSP violations
 * Uses a safe regex pattern to avoid ReDoS (Regular Expression Denial of Service) vulnerabilities
 * @param html - The HTML string to clean
 * @returns HTML string without inline style attributes
 */

function ElementHeader({
  headline,
  description,
  required = false,
  htmlFor,
  className,
  imageUrl,
  videoUrl,
  imageAltText,
  ...props
}: Readonly<ElementHeaderProps>): React.JSX.Element {
  const isMediaAvailable = imageUrl ?? videoUrl;

  // Check if headline is HTML
  const strippedHeadline = stripInlineStyles(headline);
  const isHeadlineHtml = isValidHTML(strippedHeadline);
  const safeHeadlineHtml =
    isHeadlineHtml && strippedHeadline
      ? DOMPurify.sanitize(strippedHeadline, {
          ADD_ATTR: ["target"],
          FORBID_ATTR: ["style"],
        })
      : "";

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {/* Media (Image or Video) */}
      {isMediaAvailable ? (
        <ElementMedia imgUrl={imageUrl} videoUrl={videoUrl} altText={imageAltText} />
      ) : null}

      {/* Headline */}
      <div>
        <div>
          {required ? <span className="label-headline mb-[3px] text-xs opacity-60">Required</span> : null}
        </div>
        <div className="flex">
          {isHeadlineHtml && safeHeadlineHtml ? (
            <Label htmlFor={htmlFor} variant="headline">
              {headline}
            </Label>
          ) : (
            <Label htmlFor={htmlFor} variant="headline" className="font-semibold">
              {headline}
            </Label>
          )}
        </div>
      </div>

      {/* Description/Subheader */}
      {description ? (
        <Label htmlFor={htmlFor} variant="description">
          {description}
        </Label>
      ) : null}
    </div>
  );
}

export { ElementHeader };
export type { ElementHeaderProps };
