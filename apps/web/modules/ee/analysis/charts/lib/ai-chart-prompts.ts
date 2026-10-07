import type { TFunction } from "i18next";
import { BarChart3Icon, LineChartIcon, type LucideIcon, PieChartIcon, SigmaIcon } from "lucide-react";

/** Longest prompt the chart generator accepts, matching the field's own limit. */
export const AI_CHART_PROMPT_MAX_LENGTH = 2000;

/**
 * Four starting points for someone who has not written an analytics prompt before.
 *
 * Deliberately about reporting needs rather than about charts: a person opening this knows what
 * they want to learn, not whether that is a line or a bar — and the generator picks the shape
 * anyway. Each also has to hold for *any* survey, so none of them names a question or a field.
 */
export const getChartHelperPrompts = (
  t: TFunction
): {
  label: string;
  prompt: string;
  Icon: LucideIcon;
}[] => [
  {
    label: t("workspace.analysis.charts.ai_create.prompt_helper_volume_label"),
    prompt: t("workspace.analysis.charts.ai_create.prompt_helper_volume"),
    Icon: LineChartIcon,
  },
  {
    label: t("workspace.analysis.charts.ai_create.prompt_helper_completion_label"),
    prompt: t("workspace.analysis.charts.ai_create.prompt_helper_completion"),
    Icon: SigmaIcon,
  },
  {
    label: t("workspace.analysis.charts.ai_create.prompt_helper_scores_label"),
    prompt: t("workspace.analysis.charts.ai_create.prompt_helper_scores"),
    Icon: BarChart3Icon,
  },
  {
    label: t("workspace.analysis.charts.ai_create.prompt_helper_breakdown_label"),
    prompt: t("workspace.analysis.charts.ai_create.prompt_helper_breakdown"),
    Icon: PieChartIcon,
  },
];

/**
 * Whether this generation can actually run. The feedback directory is part of the gate, not just of
 * the request: without one the action has nothing to query, and a Generate button that stays live
 * and does nothing is worse than one that is plainly unavailable.
 */
export function canGenerateChart(
  prompt: string,
  isAIAvailable: boolean,
  isGenerating: boolean,
  hasFeedbackDirectory: boolean
): boolean {
  return isAIAvailable && hasFeedbackDirectory && !isGenerating && prompt.trim().length > 0;
}
