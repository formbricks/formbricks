"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getImportSourceLabel } from "@/modules/survey/import/lib/import-i18n";
import {
  type TImportProgressState,
  type TImportProgressStep,
  formatLanguageCodes,
  getImportProgressSteps,
} from "@/modules/survey/import/lib/import-progress";
import { AiIcon } from "@/modules/ui/components/ai";

type ImportProgressLadderProps = {
  progress: TImportProgressState;
  isActive: boolean;
  className?: string;
};

/**
 * Four steps — read file, detected languages, extracting questions, validating — driven by the
 * stream's `progress` events. The current step spins (still for `prefers-reduced-motion`); a done
 * step keeps its detail so the user can read back what happened.
 */
export const ImportProgressLadder = ({
  progress,
  isActive,
  className,
}: Readonly<ImportProgressLadderProps>) => {
  const { t } = useTranslation();
  const steps = getImportProgressSteps(progress);
  const isAiLane = progress.source?.lane === "ai";

  const labelFor = (step: TImportProgressStep): string => {
    switch (step.stage) {
      case "reading":
        return t("workspace.surveys.import.progress_read_file");
      case "detecting_languages":
        return t("workspace.surveys.import.progress_detected_languages");
      case "extracting":
        return t("workspace.surveys.import.progress_extracting");
      default:
        return t("workspace.surveys.import.progress_validating");
    }
  };

  const detailFor = (step: TImportProgressStep): string | null => {
    if (step.status === "pending") return null;
    switch (step.stage) {
      case "reading":
        return progress.source ? getImportSourceLabel(progress.source.kind, t) : null;
      case "detecting_languages":
        return step.languageCodes.length > 0 ? formatLanguageCodes(step.languageCodes) : null;
      case "extracting":
        return step.chunk
          ? t("workspace.surveys.import.progress_part", { index: step.chunk.index, total: step.chunk.total })
          : null;
      default:
        return null;
    }
  };

  const current = steps.find((step) => step.status === "current");

  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      {isActive ? (
        <div className="flex items-center gap-2">
          {isAiLane ? <AiIcon animated /> : null}
          <span role="status" aria-live="polite" aria-atomic="true" className="text-slate-700">
            {current ? labelFor(current) : t("workspace.surveys.import.status_reading")}
          </span>
        </div>
      ) : null}
      <ol className="flex flex-col gap-1.5" aria-label={t("workspace.surveys.import.progress_label")}>
        {steps.map((step) => {
          const detail = detailFor(step);
          return (
            <li
              key={step.stage}
              className={cn(
                "flex items-center gap-2",
                step.status === "pending" && "text-slate-400",
                step.status === "current" && "text-slate-900",
                step.status === "done" && "text-slate-600"
              )}
              aria-current={step.status === "current" ? "step" : undefined}>
              <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                {step.status === "done" ? <CheckIcon className="size-4 text-green-600" /> : null}
                {step.status === "current" ? (
                  <Loader2Icon className="size-4 motion-safe:animate-spin" />
                ) : null}
                {step.status === "pending" ? <span className="size-1.5 rounded-full bg-slate-300" /> : null}
              </span>
              <span>{labelFor(step)}</span>
              {detail ? <span className="text-xs text-slate-500">{detail}</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
