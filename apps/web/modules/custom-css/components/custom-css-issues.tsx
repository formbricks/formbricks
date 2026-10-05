"use client";

import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type TCustomCssAppearance,
  type TCustomCssError,
  type TCustomCssErrorCode,
  type TCustomCssWarning,
  type TCustomCssWarningCode,
} from "@formbricks/types/custom-css";
import { cn } from "@/lib/cn";
import { type TCustomCssValidationState } from "./lib/validation";

interface CustomCssIssuesProps {
  statusId: string;
  issuesId: string;
  validation: TCustomCssValidationState;
  byteSize: number;
  byteLimit: number;
}

/**
 * The live check's outcome under the CSS field: one status line (a polite live region, so a screen
 * reader hears "valid" or "fix the errors" without losing its place) and the located list of errors
 * and removed rules the field's `aria-describedby` points at.
 */
export const CustomCssIssues = ({
  statusId,
  issuesId,
  validation,
  byteSize,
  byteLimit,
}: Readonly<CustomCssIssuesProps>) => {
  const { t } = useTranslation();

  const errorLabels: Record<TCustomCssErrorCode, string> = {
    syntax_error: t("workspace.custom_css.error_syntax_error"),
    source_too_large: t("workspace.custom_css.error_source_too_large"),
    output_too_large: t("workspace.custom_css.error_output_too_large"),
    limit_exceeded: t("workspace.custom_css.error_limit_exceeded"),
    processing_failed: t("workspace.custom_css.error_processing_failed"),
  };
  const warningLabels: Record<TCustomCssWarningCode, string> = {
    import_removed: t("workspace.custom_css.warning_import_removed"),
    font_face_removed: t("workspace.custom_css.warning_font_face_removed"),
    external_resource_removed: t("workspace.custom_css.warning_external_resource_removed"),
    unsupported_at_rule_removed: t("workspace.custom_css.warning_unsupported_at_rule_removed"),
    unsafe_property_removed: t("workspace.custom_css.warning_unsafe_property_removed"),
    unsafe_value_removed: t("workspace.custom_css.warning_unsafe_value_removed"),
    fixed_position_removed: t("workspace.custom_css.warning_fixed_position_removed"),
    unsafe_selector_removed: t("workspace.custom_css.warning_unsafe_selector_removed"),
  };
  const fieldLabels: Record<TCustomCssAppearance, string> = {
    light: t("workspace.custom_css.base_css_label"),
    dark: t("workspace.custom_css.dark_css_label"),
  };

  const getDetail = (issue: TCustomCssError | TCustomCssWarning): string => {
    if (issue.code === "source_too_large") {
      return t("workspace.custom_css.source_too_large_detail", { used: byteSize, limit: byteLimit });
    }
    return issue.reason;
  };

  const getLocation = (issue: TCustomCssError | TCustomCssWarning): string | null => {
    const parts: string[] = [];
    if (issue.appearance) parts.push(fieldLabels[issue.appearance]);
    if (issue.line !== null) {
      parts.push(t("workspace.custom_css.issue_location", { line: issue.line, column: issue.column ?? 1 }));
    }
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const { status, errors, warnings, isPreviewBehind } = validation;

  let statusText: string | null = null;
  let StatusIcon = Loader2Icon;
  if (status === "pending") {
    statusText = t("workspace.custom_css.status_checking");
  } else if (status === "valid") {
    StatusIcon = warnings.length > 0 ? AlertTriangleIcon : CheckCircle2Icon;
    statusText =
      warnings.length > 0
        ? t("workspace.custom_css.status_valid_with_warnings", { count: warnings.length })
        : t("workspace.custom_css.status_valid");
  } else if (status === "invalid") {
    StatusIcon = AlertCircleIcon;
    statusText = t("workspace.custom_css.status_invalid");
  } else if (status === "unavailable") {
    StatusIcon = AlertTriangleIcon;
    statusText = t("workspace.custom_css.status_unavailable");
  }

  const issues = [
    ...errors.map((issue) => ({ issue, label: errorLabels[issue.code], isError: true })),
    ...warnings.map((issue) => ({ issue, label: warningLabels[issue.code], isError: false })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <output
        id={statusId}
        className={cn(
          "flex items-center gap-1.5 text-xs",
          status === "invalid" ? "text-red-700" : "text-slate-600",
          !statusText && "sr-only"
        )}>
        {statusText && (
          <StatusIcon
            className={cn("size-3.5 shrink-0", status === "pending" && "animate-spin")}
            aria-hidden
          />
        )}
        <span>
          {statusText}
          {isPreviewBehind && status !== "pending" && ` ${t("workspace.custom_css.status_preview_behind")}`}
        </span>
      </output>

      {issues.length > 0 && (
        <ul id={issuesId} className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
          {issues.map(({ issue, label, isError }, index) => {
            const location = getLocation(issue);
            const detail = getDetail(issue);
            return (
              <li
                // Issues have no identity of their own; the list is replaced as a whole, never reordered.
                key={`${issue.code}-${issue.appearance}-${issue.line}-${issue.column}-${index}`}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                  isError
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                )}>
                {isError ? (
                  <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                ) : (
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                <span>
                  <span className="font-medium">{label}</span>
                  {location && <span> · {location}</span>}
                  {detail && <span className="block text-slate-600">{detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
