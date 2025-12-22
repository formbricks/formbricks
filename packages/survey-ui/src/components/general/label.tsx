import DOMPurify from "isomorphic-dompurify";
import * as React from "react";
import { cn, stripInlineStyles } from "@/lib/utils";

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

  // Base classes - use flex-col for HTML content to allow line breaks, flex items-center for non-HTML
  const baseClasses =
    isHtml && safeHtml
      ? "flex flex-col gap-2 leading-6 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      : "flex items-center gap-2 leading-6 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

  // If HTML, render with dangerouslySetInnerHTML, otherwise render normally
  if (isHtml && safeHtml) {
    if (htmlFor) {
      return (
        <label
          data-slot="label"
          data-variant={variant}
          className={cn(baseClasses, variantClass, className)}
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
        className={cn(baseClasses, variantClass, className)}
        {...(restProps as React.HTMLAttributes<HTMLSpanElement>)}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  if (htmlFor) {
    return (
      <label
        data-slot="label"
        data-variant={variant}
        className={cn(
          "flex items-center gap-2 leading-6 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          variantClass,
          className
        )}
        htmlFor={htmlFor}
        form={form}
        {...restProps}>
        {children}
      </label>
    );
  }

  return (
    <span
      data-slot="label"
      data-variant={variant}
      className={cn(
        "flex items-center gap-2 leading-6 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        variantClass,
        className
      )}
      {...(restProps as React.HTMLAttributes<HTMLSpanElement>)}>
      {children}
    </span>
  );
}

export { Label };
export type { LabelProps };
