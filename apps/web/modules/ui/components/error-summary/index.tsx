"use client";

import { AlertCircleIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

interface ErrorSummaryProps {
  /** Says what went wrong: "Something went wrong". */
  readonly heading: string;
  /** The detail that follows the heading, e.g. why a save failed. */
  readonly description?: string;
  /** Set when a failed attempt has just shown the bar: focus moves to the heading, so a screen reader reads it. */
  readonly shouldFocus?: boolean;
  /** Called once the heading has the focus, so a later remount of the bar does not take it again. */
  readonly onFocused?: (heading: HTMLElement) => void;
  readonly className?: string;
}

/**
 * A slim bar for a failure that is not about the content, such as a save the server refused. It takes one
 * row of height, so it never pushes the editor down.
 */
export const ErrorSummary = ({
  heading,
  description,
  shouldFocus,
  onFocused,
  className,
}: ErrorSummaryProps) => {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!shouldFocus) return;
    const element = headingRef.current;
    if (!element) return;
    element.focus();
    onFocused?.(element);
  }, [shouldFocus, onFocused]);

  return (
    // A labelled section, not role="alert": focus moves to the heading, which is what announces it.
    <section
      aria-labelledby={headingId}
      className={cn("flex items-center gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5", className)}>
      <AlertCircleIcon aria-hidden="true" className="size-4 shrink-0 text-error" />
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-sm font-semibold text-slate-900 focus:outline-hidden">
        {heading}
        {description ? <span className="font-normal text-error-foreground">: {description}</span> : null}
      </h2>
    </section>
  );
};
