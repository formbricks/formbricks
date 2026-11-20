"use client";

import type { TFunction } from "i18next";
import dynamic from "next/dynamic";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  type TJsonEditorVariable,
  type TJsonSyntaxError,
  findJsonSyntaxError,
} from "@/modules/ee/workflows/lib/json-editor";

/** What the editor hands the Variable picker (ENG-7113) when the author types `@`. */
export interface TJsonEditorVariableRequest {
  /** Viewport position of the typed `@`, to anchor the picker; null when it is off screen. */
  anchorRect: { left: number; top: number; bottom: number } | null;
  /** Replaces the typed `@` with the Variable as a token that keeps the JSON valid. */
  insert: (variable: TJsonEditorVariable) => void;
  /** Closes without a Variable: the `@` stays as typed and the editor gets focus back. */
  dismiss: () => void;
}

export interface JsonEditorProps {
  id?: string;
  value: string;
  /** Absent for a read-only editor, such as the body of an enabled workflow. */
  onChange?: (value: string) => void;
  /** Visible label of the field, e.g. "Request body"; read as "Request body, JSON editor". */
  label: string;
  placeholder?: string;
  /** Blank text counts as valid (no body). Off where a value is required, like a test payload. */
  allowEmpty?: boolean;
  /**
   * Called when the author types `@`. Without it `@` is plain text, as in the test payload, which
   * takes no Variables.
   */
  onRequestVariable?: (request: TJsonEditorVariableRequest) => void;
  /** Minimum height of the editing area in pixels. */
  minHeight?: number;
}

const DEFAULT_MIN_HEIGHT_PX = 120;

// CodeMirror and its JSON language are only needed once a JSON field renders, so they load in their
// own chunk instead of the workflow editor's first-load JS (ENG-7112).
const JsonCodeMirror = dynamic(
  () =>
    import("@/modules/ee/workflows/components/json-editor/json-code-mirror").then(
      (module) => module.JsonCodeMirror
    ),
  {
    ssr: false,
    loading: () => null,
  }
);

const getJsonErrorMessage = (error: TJsonSyntaxError, t: TFunction): string => {
  const params = { line: error.line };
  switch (error.code) {
    case "missing_comma":
      return t("workspace.workflows.json_error_missing_comma", params);
    case "missing_colon":
      return t("workspace.workflows.json_error_missing_colon", params);
    case "trailing_comma":
      return t("workspace.workflows.json_error_trailing_comma", params);
    case "property_name":
      return t("workspace.workflows.json_error_property_name", params);
    case "unterminated_string":
      return t("workspace.workflows.json_error_unterminated_string", params);
    case "invalid_escape":
      return t("workspace.workflows.json_error_invalid_escape", params);
    case "unexpected_end":
      return t("workspace.workflows.json_error_unexpected_end", params);
    case "extra_content":
      return t("workspace.workflows.json_error_extra_content", params);
    case "too_deep":
      return t("workspace.workflows.json_error_too_deep", params);
    case "invalid_value":
      return t("workspace.workflows.json_error_invalid_value", params);
  }
};

/**
 * A JSON field for workflow steps (ENG-7112): monospace with line numbers and JSON highlighting,
 * the line of a JSON mistake marked and the mistake said in words under the field, and `@`
 * Variables shown as chips. Used for an HTTP request body and the editable test payload.
 */
export const JsonEditor = ({
  id,
  value,
  onChange,
  label,
  placeholder,
  allowEmpty = true,
  onRequestVariable,
  minHeight = DEFAULT_MIN_HEIGHT_PX,
}: Readonly<JsonEditorProps>) => {
  const { t } = useTranslation();
  const errorId = useId();
  const error = findJsonSyntaxError(value, { allowEmpty });
  const isEditable = onChange !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "relative rounded-md border focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-1",
          isEditable ? "bg-white" : "bg-slate-50",
          error ? "border-red-500" : "border-slate-300"
        )}
        style={{ minHeight }}>
        <JsonCodeMirror
          id={id}
          value={value}
          onChange={onChange}
          ariaLabel={t("workspace.workflows.json_editor_label", { label })}
          ariaDescribedBy={error ? errorId : undefined}
          isInvalid={error !== null}
          errorLine={error?.line ?? null}
          placeholder={placeholder}
          onRequestVariable={onRequestVariable}
          minHeight={minHeight}
        />
      </div>
      {/* Kept mounted so screen readers announce each new mistake as it appears. */}
      <p id={errorId} aria-live="polite" className="text-sm text-error empty:hidden">
        {error ? getJsonErrorMessage(error, t) : null}
      </p>
    </div>
  );
};
