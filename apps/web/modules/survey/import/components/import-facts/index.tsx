"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getImportSourceLabel } from "@/modules/survey/import/lib/import-i18n";
import type { TImportReportSource, TImportReportSummary } from "@/modules/survey/import/types";

type ImportFactsProps = {
  summary: TImportReportSummary;
  source?: TImportReportSource;
  className?: string;
};

/** The facts row above the review list: what the file turned into, at a glance. */
export const ImportFacts = ({ summary, source, className }: Readonly<ImportFactsProps>) => {
  const { t } = useTranslation();

  const facts: string[] = [
    t("workspace.surveys.import.facts_questions", { count: summary.elements }),
    t("workspace.surveys.import.facts_blocks", { count: summary.blocks }),
  ];
  if (summary.endings > 0) {
    facts.push(t("workspace.surveys.import.facts_endings", { count: summary.endings }));
  }
  if (summary.languages.length > 0) {
    facts.push(summary.languages.map((code) => code.split("-")[0].toUpperCase()).join(" · "));
  }
  if (summary.logicRules > 0 || summary.logicRulesReported > 0) {
    facts.push(
      t("workspace.surveys.import.facts_logic_rules", {
        count: summary.logicRules,
        reported: summary.logicRulesReported,
      })
    );
  }
  if (source) {
    facts.push(getImportSourceLabel(source.kind, t));
  }

  return (
    <ul
      className={cn("flex flex-wrap gap-1.5", className)}
      aria-label={t("workspace.surveys.import.facts_label")}>
      {facts.map((fact) => (
        <li
          key={fact}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 tabular-nums">
          {fact}
        </li>
      ))}
    </ul>
  );
};
