"use client";

import { AlertTriangleIcon, ChevronDownIcon, DownloadIcon, InfoIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  formatQsfImportReport,
  getQsfImportIssueLine,
  getQsfImportReportFileName,
  hasQsfImportWarnings,
  sortQsfImportIssues,
} from "@/modules/survey/import/lib/import-report";
import type { TQsfImportReport } from "@/modules/survey/import/types";
import { Button } from "@/modules/ui/components/button";

type ImportReportProps = {
  report: TQsfImportReport;
  className?: string;
};

// Attached while it is clicked, as Firefox needs, and the URL released on the next task: Safari starts
// the download after the click returns.
const downloadText = (text: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Everything the import left out or changed, one line each. Opens by itself when there is a warning
 * (ENG-3411); Download keeps it once the draft opens in the editor (ENG-3605). Every line is rendered
 * as text: file names and `params` come from the user's file or the AI.
 */
export const ImportReport = ({ report, className }: Readonly<ImportReportProps>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(() => hasQsfImportWarnings(report));

  const issues = sortQsfImportIssues(report.issues);
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const noteCount = issues.length - warningCount;
  const summary = [
    warningCount > 0 ? t("workspace.surveys.import.report.summary_warnings", { count: warningCount }) : null,
    noteCount > 0 ? t("workspace.surveys.import.report.summary_notes", { count: noteCount }) : null,
  ].filter((part): part is string => part !== null);

  const toggle = () => setIsOpen((open) => !open);

  const handleDownload = () => {
    downloadText(formatQsfImportReport(report, t), getQsfImportReportFileName(report.source.fileName));
  };

  return (
    <section className={cn("rounded-md border border-slate-200 bg-white", className)}>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-slate-700"
          aria-expanded={isOpen}
          aria-controls="import-report-lines"
          disabled={issues.length === 0}
          onClick={toggle}>
          <span className="font-medium">{t("workspace.surveys.import.report.title")}</span>
          <span className="truncate text-xs text-slate-500">
            {summary.length > 0 ? summary.join(" · ") : t("workspace.surveys.import.report.empty")}
          </span>
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={handleDownload}>
          <DownloadIcon aria-hidden="true" />
          {t("workspace.surveys.import.report.download")}
        </Button>
        {issues.length > 0 ? (
          // Last in the row, after Download, and a second way to toggle for the pointer only: the
          // title's button is the one keyboard and screen reader users reach.
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center text-slate-500"
            onClick={toggle}>
            <ChevronDownIcon className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        ) : null}
      </div>
      {isOpen && issues.length > 0 ? (
        <ul
          id="import-report-lines"
          className="max-h-40 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
          {issues.map((issue, index) => (
            <li
              // Lines carry no id, and two can read the same, so their position is part of the key.
              key={`${issue.code}-${issue.questionTag ?? ""}-${index}`}
              className="flex items-start gap-2 px-3 py-2 text-xs text-slate-600">
              {issue.severity === "warning" ? (
                <AlertTriangleIcon className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
              ) : (
                <InfoIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">{getQsfImportIssueLine(issue, t)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
