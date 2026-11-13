"use client";

import { useRef } from "react";
import type { TWorkflowVariableRequest } from "@/modules/ee/workflows/components/variable-picker/use-workflow-variable-picker";
import {
  fromVariableInputDisplay,
  insertVariableAtCaret,
  toVariableInputDisplay,
} from "@/modules/ee/workflows/lib/variable-input";
import { Input } from "@/modules/ui/components/input";

interface WorkflowVariableInputProps {
  id?: string;
  /** Stored text, with recall tokens. */
  value: string;
  onChange: (value: string) => void;
  /** The step's Variable picker; typing `@` opens it at the field. */
  requestVariable: (request: TWorkflowVariableRequest) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * A one-line field that takes Variables: `@` opens the Variable picker, and a picked Variable shows
 * as `{{payload.customer.id}}` (see `lib/variable-input.ts`).
 */
export const WorkflowVariableInput = ({
  id,
  value,
  onChange,
  requestVariable,
  disabled,
  placeholder,
  className,
  ...rest
}: Readonly<WorkflowVariableInputProps>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = toVariableInputDisplay(value);

  return (
    <Input
      ref={inputRef}
      id={id}
      value={display}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={rest["aria-label"]}
      className={className}
      onChange={(event) => {
        const nextDisplay = event.target.value;
        const caret = event.target.selectionStart ?? nextDisplay.length;
        onChange(fromVariableInputDisplay(nextDisplay));
        if (nextDisplay[caret - 1] !== "@" || nextDisplay.length <= display.length) return;
        const rect = event.target.getBoundingClientRect();
        requestVariable({
          anchorRect: { left: rect.left, top: rect.top, bottom: rect.bottom },
          insert: ({ path }) => {
            const inserted = insertVariableAtCaret(nextDisplay, caret, path);
            if (!inserted) return;
            onChange(fromVariableInputDisplay(inserted.display));
            requestAnimationFrame(() => {
              inputRef.current?.focus();
              inputRef.current?.setSelectionRange(inserted.caret, inserted.caret);
            });
          },
          dismiss: () => inputRef.current?.focus(),
        });
      }}
    />
  );
};
