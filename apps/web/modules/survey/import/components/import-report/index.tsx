"use client";

import { AlertTriangleIcon, ChevronDownIcon, InfoIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getImportIssueMessage } from "@/modules/survey/import/lib/import-i18n";
import { countIssues } from "@/modules/survey/import/report";
import type { TImportIssue, TImportIssueSeverity } from "@/modules/survey/import/types";

type ImportReportProps = {
  issues: readonly TImportIssue[];
  /** Expanded by default when any warning or error exists; collapsed when the report is notes only. */
  defaultOpen?: boolean;
  className?: string;
};

const SEVERITY_ORDER: Record<TImportIssueSeverity, number> = { error: 0, warning: 1, info: 2 };

const SeverityIcon = ({ severity }: { severity: TImportIssueSeverity }) => {
  if (severity === "error")
    return <XCircleIcon className="size-4 shrink-0 text-red-600" aria-hidden="true" />;
  if (severity === "warning")
    return <AlertTriangleIcon className="size-4 shrink-0 text-amber-600" aria-hidden="true" />;
  return <InfoIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />;
};

/**
 * Every strip, match and creation the import made, in plain language. Collapsible so a clean import
 * stays out of the way, expanded whenever something changed the survey.
 */
export const ImportReport = ({ issues, defaultOpen, className }: Readonly<ImportReportProps>) => {
  const { t } = useTranslation();
  const counts = countIssues(issues);
  const hasChanges = counts.error > 0 || counts.warning > 0;
  const [isOpen, setIsOpen] = useState(defaultOpen ?? hasChanges);

  if (issues.length === 0) {
    return (
      <p className={cn("text-xs text-slate-500", className)}>{t("workspace.surveys.import.report_empty")}</p>
    );
  }

  const sorted = [...issues].sort(
    (left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
  );
  const summaryParts = [
    counts.error > 0 ? t("workspace.surveys.import.report_errors", { count: counts.error }) : null,
    counts.warning > 0 ? t("workspace.surveys.import.report_warnings", { count: counts.warning }) : null,
    counts.info > 0 ? t("workspace.surveys.import.report_notes", { count: counts.info }) : null,
  ].filter((part): part is string => part !== null);

  return (
    <section className={cn("rounded-md border border-slate-200 bg-white", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}>
        <span className="font-medium">{t("workspace.surveys.import.report_title")}</span>
        <span className="text-xs text-slate-500">· {summaryParts.join(" · ")}</span>
        <ChevronDownIcon
          className={cn("ml-auto size-4 text-slate-500 transition-transform", isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {isOpen ? (
        <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
          {sorted.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.path ?? ""}-${index}`}
              className="flex items-start gap-2 px-3 py-2 text-xs">
              <SeverityIcon severity={issue.severity} />
              <div className="min-w-0 flex-1">
                {issue.sourceRef ? (
                  <span className="font-semibold text-slate-700">{issue.sourceRef}: </span>
                ) : null}
                <span className="text-slate-600">{getImportIssueMessage(issue, t)}</span>
                {issue.path ? (
                  <span className="ml-1 font-mono text-[10px] text-slate-400">{issue.path}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
