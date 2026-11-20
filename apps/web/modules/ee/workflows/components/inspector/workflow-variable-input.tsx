"use client";

import { useMemo } from "react";
import { withEveryRecallTokenKept } from "@/modules/ee/workflows/lib/variable-input";
import { RecallInput } from "@/modules/ui/components/editor/components/recall-input";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";

interface WorkflowVariableInputProps {
  id?: string;
  /** Stored text, with recall tokens. */
  value: string;
  onChange: (value: string) => void;
  /** The step's Variable picker (`useWorkflowVariablePicker().recallSource`); `@` opens it. */
  recallSource: TEditorRecallSource;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  isInvalid?: boolean;
}

/**
 * A one-line field that takes Variables: `@` opens the Variable picker, and a picked Variable shows
 * as the chip the email body uses, its fallback editable as in survey recall (see
 * `lib/variable-input.ts`). The stored value keeps its `#recall:<path>/fallback:<text>#` tokens.
 */
export const WorkflowVariableInput = ({ recallSource, ...props }: Readonly<WorkflowVariableInputProps>) => {
  const source = useMemo(() => withEveryRecallTokenKept(recallSource), [recallSource]);
  return <RecallInput {...props} recallSource={source} />;
};
