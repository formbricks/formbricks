"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getEmbeddedDataUsageAction } from "@/modules/embedded-data/actions";
import type { TEmbeddedDataUsageItem } from "@/modules/embedded-data/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { getSurveyStatusLabel } from "../lib/field-labels";
import { getUsageLabel } from "../lib/library-field";

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
 * for a panel most rows never open.
 *
 * Once loaded they are kept, and the reason is narrower than "a refresh clears them": `router.refresh()`
 * re-renders the server components but preserves client state, so this cache outlives every write on
 * this page. It is safe because nothing here changes which surveys link a field — links are edited in
 * the survey editor, and arriving from there is a navigation, which does remount. The one visible
 * seam is a link changed in another tab: the cell's count comes from the server and would refresh,
 * while an already-open popover's names would not.
 *
 * **The whole cell is the control, whichever answer it gives.** The trigger fills its cell rather
 * than hugging its text, so the gap beside "2 surveys" opens the popover like the words do; and an
 * unused row renders no trigger at all and stops nothing, so clicking "Not used" opens the field for
 * editing exactly as clicking anywhere else on that row does.
 */
export const FieldUsageCell = ({ fieldId, workspaceId, surveyCount }: Readonly<FieldUsageCellProps>) => {
  const { t } = useTranslation();
  const [usage, setUsage] = useState<TEmbeddedDataUsageItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = getUsageLabel(surveyCount);

  if (label.kind === "unused") {
    // `block`, so the span covers the cell it is given: the row's own click handler is what a click
    // anywhere in here reaches, and a dead patch in the middle of a clickable row is the bug.
    return <span className="block text-slate-500">{t("workspace.embedded_data.not_used")}</span>;
  }

  const text = t("workspace.embedded_data.used_in_surveys", { count: label.count });

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
    // A successful empty answer is reachable: `surveyCount` is as old as the page, so the last
    // linking survey may have been deleted since. Without this the panel renders an empty list.
    if (usage.length === 0)
      return <p className="text-sm text-slate-500">{t("workspace.embedded_data.not_used")}</p>;

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
      <PopoverTrigger
        // The row behind this one opens the edit dialog. Stopping the click here rather than on the
        // column keeps that suppression to the trigger, which is the only part of the cell that has
        // something else to do with it.
        onClick={(event) => event.stopPropagation()}
        className="-m-1 flex w-full cursor-pointer items-center rounded-sm p-1 text-left text-sm text-slate-800 underline underline-offset-2 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden">
        {text}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 shadow-lg">
        {renderBody()}
      </PopoverContent>
    </Popover>
  );
};
