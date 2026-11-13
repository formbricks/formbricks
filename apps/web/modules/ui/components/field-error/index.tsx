"use client";

import { AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface FieldErrorProps {
  /** The id the field's `aria-describedby` points at. */
  readonly id?: string;
  readonly message?: string | null;
  readonly className?: string;
}

/**
 * The message under a field's label: a red icon and a short text that says what to fix.
 *
 * The live region stays mounted, so a screen reader announces the message when it appears instead of
 * missing a region that arrives with its content. The icon is decoration (`aria-hidden`); the text carries
 * the meaning. Layout uses logical properties only, so the icon moves to the right in right-to-left text.
 */
export const FieldError = ({ id, message, className }: FieldErrorProps) => (
  <div id={id} aria-live="polite" aria-atomic="true" className={className}>
    {message ? (
      <p className={cn("mb-2 flex items-start gap-1 text-start text-sm text-error")}>
        <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{message}</span>
      </p>
    ) : null}
  </div>
);

/** The attributes that tie an input to its `FieldError`; empty while there is nothing to report. */
export const getFieldErrorAria = (errorId: string, message?: string | null) =>
  message ? { "aria-invalid": true, "aria-describedby": errorId } : {};
