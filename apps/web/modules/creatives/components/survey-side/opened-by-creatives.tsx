"use client";

import { ArrowUpRightIcon, MousePointerClickIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { CreativeStatusPill } from "@/modules/creatives/components/creative-status-pill";
import { getCreativeEditPath } from "@/modules/creatives/lib/paths";
import type { TSurveyLinkedCreative } from "@/modules/creatives/lib/survey-side";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface OpenedByCreativesProps {
  workspaceId: string;
  creatives: readonly TSurveyLinkedCreative[];
}

/**
 * The Survey Trigger card's read-only "Opened by: <creative>" rows, one per linked creative, Draft
 * included (ENG-3579). The creative is edited in its own editor, opened in a new tab so the survey's
 * unsaved changes stay.
 */
export const OpenedByCreatives = ({ workspaceId, creatives }: Readonly<OpenedByCreativesProps>) => {
  const { t } = useTranslation();
  if (creatives.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {creatives.map((creative) => (
        <li
          key={creative.id}
          className="flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-white p-2 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <MousePointerClickIcon className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
            <p className="truncate text-sm font-semibold text-slate-600">
              {t("workspace.creatives.survey_side.opened_by", { creative: creative.name })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CreativeStatusPill
              state={{ status: creative.displayStatus, reason: creative.displayStatusReason }}
            />
            <TooltipRenderer tooltipContent={t("workspace.creatives.survey_side.open_creative")}>
              <Button variant="secondary" size="icon" asChild>
                <Link
                  href={getCreativeEditPath(workspaceId, creative.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("workspace.creatives.survey_side.open_creative")}>
                  <ArrowUpRightIcon />
                </Link>
              </Button>
            </TooltipRenderer>
          </div>
        </li>
      ))}
    </ul>
  );
};
