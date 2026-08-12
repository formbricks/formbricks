import * as React from "react";
import { cn, sanitizeSurveyHtml, stripInlineStyles } from "@/lib/utils";

type LabelVariant = "default" | "headline" | "description" | "card";

interface LabelProps extends React.ComponentProps<"label"> {
  /** Label variant for different styling contexts */
  variant?: LabelVariant;
}

const VARIANT_CLASSES: Record<LabelVariant, string> = {
  default: "label-default",
  headline: "label-headline",
  description: "label-description",
  card: "label-card",
};

// Element headlines and descriptions are content respondents read (and may want to
// copy or have translated), so they stay selectable. Labels that act as controls —
// choices, cards — keep select-none so a stray drag doesn't highlight them.
const READABLE_VARIANTS: LabelVariant[] = ["headline", "description"];

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

function Label({
  className,
  variant = "default",
  children,
  ...props
}: Readonly<LabelProps>): React.JSX.Element {
  const { htmlFor, form, ...restProps } = props;

  // Check if children is a string and contains HTML
  const childrenString = typeof children === "string" ? children : null;
  const strippedContent = childrenString ? stripInlineStyles(childrenString) : "";
  const isHtml = childrenString ? isValidHTML(strippedContent) : false;
  const safeHtml = isHtml && strippedContent ? sanitizeSurveyHtml(strippedContent) : "";

  // Base classes - use flex-col for HTML content to allow line breaks, flex items-center for non-HTML
  const baseClasses = cn(
    isHtml && safeHtml ? "flex flex-col gap-2" : "flex items-center gap-2",
    "leading-6 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
    READABLE_VARIANTS.includes(variant) ? "select-text" : "select-none",
    VARIANT_CLASSES[variant]
  );

  // If HTML, render with dangerouslySetInnerHTML, otherwise render normally
  if (isHtml && safeHtml) {
    if (htmlFor) {
      return (
        <label
          data-slot="label"
          data-variant={variant}
          className={cn(baseClasses, className)}
          htmlFor={htmlFor}
          form={form}
          {...restProps}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      );
    }

    return (
      <span
        data-slot="label"
        data-variant={variant}
        className={cn(baseClasses, className)}
        {...restProps}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  if (htmlFor) {
    return (
      <label
        data-slot="label"
        data-variant={variant}
        className={cn(baseClasses, className)}
        htmlFor={htmlFor}
        form={form}
        {...restProps}>
        {children}
      </label>
    );
  }

  return (
    <span data-slot="label" data-variant={variant} className={cn(baseClasses, className)} {...restProps}>
      {children}
    </span>
  );
}

export { Label };
export type { LabelProps, LabelVariant };
