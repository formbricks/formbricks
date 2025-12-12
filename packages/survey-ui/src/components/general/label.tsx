"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import DOMPurify from "isomorphic-dompurify";
import * as React from "react";
import { cn } from "@/lib/utils";

interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
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

  // Determine variant class
  let variantClass = "label-default";
  if (variant === "headline") {
    variantClass = "label-headline";
  } else if (variant === "description") {
    variantClass = "label-description";
  }

  // If HTML, render with dangerouslySetInnerHTML, otherwise render normally
  if (isHtml && safeHtml) {
    return (
      <LabelPrimitive.Root
        data-slot="label"
        data-variant={variant}
        className={cn(
          "flex select-none items-center gap-2 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
          variantClass,
          className
        )}
        {...props}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <LabelPrimitive.Root
      data-slot="label"
      data-variant={variant}
      className={cn(
        "flex select-none items-center gap-2 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        variantClass,
        className
      )}
      {...props}>
      {children}
    </LabelPrimitive.Root>
  );
}

export { Label };
export type { LabelProps };
