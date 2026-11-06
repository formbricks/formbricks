"use client";

import { SquareArrowRightExitIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { TruncationTooltip } from "@/modules/ui/components/info-tooltip";

interface StartScreenOutBannerProps {
  /** The rule that ended the preview, as the Flow tab writes it ("If @panel_id is not set → …"). */
  readonly ruleSummary: string;
  /** Opens Test values on the field the rule reads. Absent when the survey has no test values. */
  readonly onSetTestValues?: () => void;
  readonly className?: string;
}

/**
 * The banner above a preview that a rule before the first question screened out (ENG-6969 T13 ①):
 * "Ended before the first question", the rule, and "Set test values". Without it the preview opens
 * on an ending and looks broken until the author finds Test values.
 */
export const StartScreenOutBanner = ({
  ruleSummary,
  onSetTestValues,
  className,
}: StartScreenOutBannerProps) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid="preview-start-screen-out-banner"
      className={cn(
        "flex w-full min-w-0 items-center gap-2 border-b border-amber-200 bg-amber-50 py-1.5 pr-1 pl-3 text-xs",
        className
      )}>
      <SquareArrowRightExitIcon className="size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-medium text-slate-900">
          {t("workspace.surveys.edit.preview_ended_before_first_question")}
        </p>
        <TruncationTooltip content={ruleSummary} className="min-w-0 truncate text-slate-600" side="bottom">
          {ruleSummary}
        </TruncationTooltip>
      </div>
      {onSetTestValues && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          onClick={onSetTestValues}>
          {t("workspace.surveys.edit.set_test_values")}
        </Button>
      )}
    </div>
  );
};
