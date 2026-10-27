"use client";

import { useTranslation } from "react-i18next";
import { getQsfImportFacts } from "@/modules/survey/import/lib/import-report";
import type { TQsfImportReport } from "@/modules/survey/import/types";

/** The facts row above the review list: what the file turned into, at a glance. */
export const ImportFacts = ({ summary }: Readonly<{ summary: TQsfImportReport["summary"] }>) => {
  const { t } = useTranslation();

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("workspace.surveys.import.facts.label")}>
      {getQsfImportFacts(summary, t).map((fact) => (
        <li
          key={fact}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 tabular-nums">
          {fact}
        </li>
      ))}
    </ul>
  );
};
