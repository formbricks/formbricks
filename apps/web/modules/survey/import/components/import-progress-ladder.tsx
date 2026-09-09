"use client";

import { useTranslation } from "react-i18next";
import { getImportSourceLabel } from "@/modules/survey/import/lib/import-i18n";
import {
  type TImportProgressState,
  type TImportProgressStep,
  formatLanguageCodes,
  getImportProgressSteps,
} from "@/modules/survey/import/lib/import-progress";
import { AiStatusLine } from "@/modules/ui/components/ai";

type ImportProgressLadderProps = {
  progress: TImportProgressState;
  isActive: boolean;
  className?: string;
};

/**
 * The import's waiting state is the kit's `AiStatusLine`: the phrase is the stage the server reported
 * (`activeIndex`, never a timer) with its detail folded in, and the elapsed time runs for the AI lane.
 * Deterministic lanes finish in two events and read the same way without the timer.
 */
export const ImportProgressLadder = ({
  progress,
  isActive,
  className,
}: Readonly<ImportProgressLadderProps>) => {
  const { t } = useTranslation();
  const steps = getImportProgressSteps(progress);
  const isAiLane = progress.source?.lane === "ai";

  const labelFor = (stage: TImportProgressStep["stage"]): string => {
    switch (stage) {
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

  // One phrase per stage, with the detail the server sent folded in ("Extracting questions · part 2 of 5").
  const messages = steps.map((step) => {
    const detail = detailFor(step);
    return detail ? `${labelFor(step.stage)} · ${detail}` : labelFor(step.stage);
  });
  const currentIndex = steps.findIndex((step) => step.status === "current");

  return (
    <AiStatusLine
      isActive={isActive}
      messages={messages}
      activeIndex={currentIndex >= 0 ? currentIndex : 0}
      showTimer={isAiLane}
      className={className}
    />
  );
};
