"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getEmbeddedDataUsageAction } from "@/modules/embedded-data/actions";
import type { TEmbeddedDataUsageItem } from "@/modules/embedded-data/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { getUsageLabel } from "../lib/library-field";
import { getSurveyStatusLabel } from "./field-labels";

interface FieldUsageCellProps {
  fieldId: string;
  workspaceId: string;
  surveyCount: number;
}

/**
 * The "Used in" cell: a count, and for a field that is used, a popover naming the surveys.
 *
 * The names are fetched when the popover opens rather than with the list. The list query already
 * counts the links, which is what the cell reads; loading every survey name for every row would pay
 * for a panel most rows never open. Once loaded they are kept — the same row reopened is the common
 * case, and a library field's usage does not change while the page is open unless this user changes
 * it, which reloads the route anyway.
 */
export const FieldUsageCell = ({ fieldId, workspaceId, surveyCount }: Readonly<FieldUsageCellProps>) => {
  const { t } = useTranslation();
  const [usage, setUsage] = useState<TEmbeddedDataUsageItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = getUsageLabel(surveyCount);

  if (label.kind === "unused") {
    return <span className="text-slate-500">{t("workspace.embedded_data.not_used")}</span>;
  }

  const text =
    label.kind === "single"
      ? t("workspace.embedded_data.used_in_one_survey")
      : t("workspace.embedded_data.used_in_surveys", { count: label.count });

  const loadUsage = async () => {
    setError(null);
    const response = await getEmbeddedDataUsageAction({ id: fieldId });
    if (!response?.data) {
      setError(getFormattedErrorMessage(response) || t("common.something_went_wrong_please_try_again"));
      return;
    }
    setUsage(response.data);
  };

  const renderBody = () => {
    if (error) return <p className="text-sm text-error">{error}</p>;
    if (!usage) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;

    return (
      <ul className="flex flex-col gap-2">
        {usage.map((survey) => (
          <li key={survey.id} className="flex items-center justify-between gap-3">
            <Link
              href={`/workspaces/${workspaceId}/surveys/${survey.id}/edit`}
              className="truncate text-sm text-slate-800 underline underline-offset-2 hover:text-slate-900">
              {survey.name}
            </Link>
            <span className="shrink-0 text-xs text-slate-500">{getSurveyStatusLabel(survey.status, t)}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && !usage) void loadUsage();
      }}>
      <PopoverTrigger className="rounded-sm text-sm text-slate-800 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden">
        {text}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 shadow-lg">
        {renderBody()}
      </PopoverContent>
    </Popover>
  );
};
