"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Label } from "@/modules/ui/components/label";

/**
 * Label + inline error pair for the inspector's config forms. The dashboard's `Form` set
 * (`FormLabel`/`FormError`) is bound to a react-hook-form context, but the inspector has no form
 * submit at all — validity is derived from the workflow definition and autosaved — so these mirror
 * its visual contract (`text-red-500` label, `text-error` message) without the RHF dependency.
 */

interface WorkflowFieldLabelProps {
  htmlFor?: string;
  /**
   * Set when the control can't be reached by `htmlFor` — the rich-text editor owns a
   * contenteditable, so it points its own `aria-labelledby` at this id instead.
   */
  id?: string;
  /** Renders the required marker; the accessible name carries the word, not the glyph. */
  isRequired?: boolean;
  isInvalid?: boolean;
  children: ReactNode;
}

export const WorkflowFieldLabel = ({
  htmlFor,
  id,
  isRequired,
  isInvalid,
  children,
}: Readonly<WorkflowFieldLabelProps>) => {
  const { t } = useTranslation();

  return (
    <Label htmlFor={htmlFor} id={id} className={cn("block", isInvalid && "text-red-500")}>
      {children}
      {isRequired ? (
        <>
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
          <span className="sr-only"> ({t("common.required")})</span>
        </>
      ) : null}
    </Label>
  );
};

interface WorkflowFieldErrorProps {
  /** Referenced by the control's `aria-describedby` so the message is announced with it. */
  id: string;
  children: ReactNode;
}

export const WorkflowFieldError = ({ id, children }: Readonly<WorkflowFieldErrorProps>) => (
  <p id={id} className="text-sm text-error">
    {children}
  </p>
);
