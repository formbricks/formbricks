"use client";

import DOMPurify from "isomorphic-dompurify";
import * as React from "react";
import { cn } from "@/lib/utils";

interface LabelProps extends React.ComponentProps<"label"> {
  /** Label variant for different styling contexts */
  variant?: "default" | "headline" | "description";
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
 * @param html - The HTML string to clean
 * @returns HTML string without inline style attributes
 */
const stripInlineStyles = (html: string): string => {
  return html.replace(/\s*style\s*=\s*["'][^"']*["']/gi, "");
};

function Label({ className, variant = "default", children, ...props }: LabelProps): React.JSX.Element {
  // Default styles driven by CSS variables based on variant
  const getCssVarStyles = (): React.CSSProperties => {
    if (variant === "headline") {
      return {
        fontFamily: "var(--fb-element-headline-font-family)",
        fontWeight: "var(--fb-element-headline-font-weight)" as React.CSSProperties["fontWeight"],
        fontSize: "var(--fb-element-headline-font-size)",
        color: "var(--fb-element-headline-color)",
        opacity: "var(--fb-element-headline-opacity)",
      };
    }

    if (variant === "description") {
      return {
        fontFamily: "var(--fb-element-description-font-family)",
        fontWeight: "var(--fb-element-description-font-weight)" as React.CSSProperties["fontWeight"],
        fontSize: "var(--fb-element-description-font-size)",
        color: "var(--fb-element-description-color)",
        opacity: "var(--fb-element-description-opacity)",
      };
    }

    // Default variant styles
    return {
      fontFamily: "var(--fb-label-font-family)",
      fontWeight: "var(--fb-label-font-weight)" as React.CSSProperties["fontWeight"],
      fontSize: "var(--fb-label-font-size)",
      color: "var(--fb-label-color)",
      opacity: "var(--fb-label-opacity)",
    };
  };

  const cssVarStyles = getCssVarStyles();

  // Check if children is a string and contains HTML
  const childrenString = typeof children === "string" ? children : null;
  const strippedContent = childrenString ? stripInlineStyles(childrenString) : "";
  const isHtml = childrenString ? isValidHTML(strippedContent) : false;
  const safeHtml =
    isHtml && strippedContent
      ? DOMPurify.sanitize(strippedContent, {
          ADD_ATTR: ["target"],
          FORBID_ATTR: ["style"],
        })
      : "";

  // If HTML, render with dangerouslySetInnerHTML, otherwise render normally
  if (isHtml && safeHtml) {
    return (
      <label
        data-slot="label"
        data-variant={variant}
        className={cn(
          "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          className
        )}
        style={cssVarStyles}
        {...props}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <label
      data-slot="label"
      data-variant={variant}
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      style={cssVarStyles}
      {...props}>
      {children}
    </label>
  );
}

export { Label };
export type { LabelProps };
